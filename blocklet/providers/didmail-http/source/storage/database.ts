import type { QueryResult } from '../runtime/contracts';
import { bindings, value } from '../runtime/bindings';
import schema from './schema.json';
import { Op } from '../runtime/sequelize';

type Values = Record<string, any>;
type Options = {
  where?: Values;
  attributes?: string[] | { exclude: string[] };
  order?: string[][];
  limit?: number;
  offset?: number;
};
const encode = (v: any): any =>
  v instanceof Date
    ? v.toISOString().replace('T', ' ').replace('Z', ' +00:00')
    : typeof v === 'boolean'
      ? Number(v)
      : (v ?? null);
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const marker = 'r2://';
const normalizeDates = (table: keyof typeof schema, row: Values) => {
  for (const column of schema[table])
    if (column.type === 'DATETIME' && row[column.name] != null) {
      const date = new Date(row[column.name]);
      if (!Number.isFinite(date.getTime())) throw new Error('Invalid timestamp');
      row[column.name] = date;
    }
  return row;
};

class RecordRow {
  constructor(
    private model: Model,
    private values: Values,
  ) {}
  get(key?: string) {
    return key ? this.values[key] : this.values;
  }
  toJSON() {
    return this.values;
  }
  async update(changes: Values) {
    await this.model.update(changes, { where: { id: this.values.id } });
    const next = await this.model.findByPk(this.values.id);
    if (!next) throw new Error('Record disappeared during update');
    this.values = next.get();
    return this;
  }
  destroy() {
    return this.model.destroy({ where: { id: this.values.id } });
  }
}
class Model {
  columns: string[];
  constructor(public table: keyof typeof schema) {
    this.columns = schema[table].map((c) => c.name);
  }
  column(name: string) {
    if (!this.columns.includes(name)) throw new Error(`Unknown ${this.table} column: ${name}`);
    return quote(name);
  }
  where(where: Values = {}, args: any[] = []): { sql: string; args: any[] } {
    const conditions = Reflect.ownKeys(where).map((key) => {
      if (key === Op.or)
        return '(' + where[key as any].map((entry: Values) => this.where(entry, args).sql).join(' OR ') + ')';
      const field = this.column(String(key));
      const val = where[key as string];
      if (val === null) return field + ' IS NULL';
      if (Array.isArray(val)) {
        args.push(...val.map(encode));
        return val.length ? `${field} IN (${val.map(() => '?').join(',')})` : '0';
      }
      if (val && typeof val === 'object' && !(val instanceof Date)) {
        if (!(Op.lt in val)) throw new Error('Unsupported query operator');
        args.push(encode(val[Op.lt]));
        return `${field} < ?`;
      }
      args.push(encode(val));
      return `${field} = ?`;
    });
    return { sql: conditions.join(' AND ') || '1', args };
  }
  async hydrate(row: Values) {
    for (const col of schema[this.table]) {
      if (!(col.name in row)) continue;
      if (row[col.name] != null && col.type === 'TINYINT(1)') row[col.name] = Boolean(row[col.name]);
      if (row[col.name] != null && col.type === 'DATETIME') row[col.name] = new Date(row[col.name]);
    }
    if (typeof row.content === 'string' && row.content.startsWith(marker)) {
      const object = await bindings.BLOBS.get(row.content.slice(marker.length));
      if (!object) throw new Error('Encrypted content object missing');
      row.content = this.table === 'attachments' ? Buffer.from(await object.arrayBuffer()) : await object.text();
    }
    return new RecordRow(this, row);
  }
  async findAll(options: Options = {}) {
    const where = this.where(options.where);
    const attributes = options.attributes;
    const fields = Array.isArray(attributes)
      ? attributes
      : this.columns.filter((c) => !attributes?.exclude.includes(c));
    let sql = `SELECT ${fields.map((c) => this.column(c)).join(',')} FROM ${quote(this.table)} WHERE ${where.sql}`;
    if (options.order)
      sql +=
        ' ORDER BY ' +
        options.order.map(([c, d]) => this.column(c) + (d?.toUpperCase() === 'DESC' ? ' DESC' : ' ASC')).join(',');
    if (options.limit !== undefined) {
      if (!Number.isSafeInteger(options.limit) || options.limit < 0 || options.limit > 1000)
        throw new Error('Invalid page size');
      if (!Number.isSafeInteger(options.offset ?? 0) || (options.offset ?? 0) < 0)
        throw new Error('Invalid page offset');
      sql += ' LIMIT ? OFFSET ?';
      where.args.push(options.limit, options.offset ?? 0);
    }
    const result = await bindings.DB.prepare(sql)
      .bind(...where.args)
      .all<Values>();
    return Promise.all(result.results.map((row) => this.hydrate(row)));
  }
  async findOne(options: Options = {}) {
    return (await this.findAll({ ...options, limit: 1 }))[0] ?? null;
  }
  findByPk(id: any) {
    return this.findOne({ where: { id } });
  }
  async count(options: Options = {}) {
    const where = this.where(options.where);
    const row = await bindings.DB.prepare(`SELECT COUNT(*) AS count FROM ${quote(this.table)} WHERE ${where.sql}`)
      .bind(...where.args)
      .first<{ count: number }>();
    return row!.count;
  }
  async findAndCountAll(options: Options) {
    return { count: await this.count(options), rows: await this.findAll(options) };
  }
  async prepareInsert(values: Values) {
    const row = normalizeDates(this.table, { createdAt: new Date(), updatedAt: new Date(), ...values });
    const fields = Object.keys(row);
    fields.forEach((field) => this.column(field));
    const blobKeys: string[] = [];
    if (['mails', 'attachments'].includes(this.table) && row.content !== undefined) {
      const key = `${this.table}/${crypto.randomUUID()}`;
      await bindings.BLOBS.put(key, row.content);
      row.content = marker + key;
      blobKeys.push(key);
    }
    const statement = bindings.DB.prepare(
      `INSERT INTO ${quote(this.table)} (${fields.map((c) => this.column(c)).join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
    ).bind(...fields.map((c) => encode(row[c])));
    return { statement, blobKeys };
  }
  async create(values: Values) {
    const { statement, blobKeys } = await this.prepareInsert(values);
    let result: QueryResult;
    try {
      result = await statement.run();
    } catch (error) {
      await bindings.BLOBS.delete(blobKeys);
      if (String(error).includes('UNIQUE constraint'))
        Object.assign(error as object, { name: 'SequelizeUniqueConstraintError' });
      throw error;
    }
    return (await this.findByPk(values.id ?? result.meta.last_row_id))!;
  }
  async bulkCreate(values: Values[]) {
    const prepared: Awaited<ReturnType<Model['prepareInsert']>>[] = [];
    try {
      for (const row of values) prepared.push(await this.prepareInsert(row));
      // The transaction batch rolls back the whole group on constraint failure.
      await bindings.DB.batch(prepared.map((p) => p.statement));
    } catch (error) {
      await bindings.BLOBS.delete(prepared.flatMap((p) => p.blobKeys));
      if (String(error).includes('UNIQUE constraint'))
        Object.assign(error as object, { name: 'SequelizeUniqueConstraintError' });
      throw error;
    }
  }
  async findOrCreate({ where, defaults }: { where: Values; defaults: Values }) {
    const existing = await this.findOne({ where });
    if (existing) return [existing, false] as const;
    try {
      return [await this.create({ ...defaults, ...where }), true] as const;
    } catch (error) {
      const raced = await this.findOne({ where });
      if (raced) return [raced, false] as const;
      throw error;
    }
  }
  async update(values: Values, options: Options) {
    if ('content' in values) throw new Error('Encrypted content is immutable');
    const row: Values = {
      ...Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)),
      updatedAt: values.updatedAt ?? new Date(),
    };
    normalizeDates(this.table, row);
    const where = this.where(options.where);
    const fields = Object.keys(row);
    const result = await bindings.DB.prepare(
      `UPDATE ${quote(this.table)} SET ${fields.map((c) => this.column(c) + ' = ?').join(',')} WHERE ${where.sql}`,
    )
      .bind(...fields.map((c) => encode(row[c])), ...where.args)
      .run();
    return [result.meta.changes];
  }
  async destroy(options: Options) {
    const where = this.where(options.where);
    // Capture object keys without loading potentially large encrypted bodies.
    const rows = ['mails', 'attachments'].includes(this.table)
      ? (
          await bindings.DB.prepare(`SELECT content FROM ${quote(this.table)} WHERE ${where.sql}`)
            .bind(...where.args)
            .all<{ content: string }>()
        ).results
      : [];
    const result = await bindings.DB.prepare(`DELETE FROM ${quote(this.table)} WHERE ${where.sql}`)
      .bind(...where.args)
      .run();
    const keys = rows
      .map((r) => r.content)
      .filter((v) => typeof v === 'string' && v.startsWith(marker))
      .map((v) => v.slice(marker.length));
    if (keys.length) await bindings.BLOBS.delete(keys);
    return result.meta.changes;
  }
}
export const Mail = new Model('mails'),
  Attachment = new Model('attachments'),
  Contact = new Model('contacts');
export const Envelope = new Model('envelopes'),
  Namecard = new Model('namecards');
export const Alias = new Model('aliases'),
  DomainBinding = new Model('domain_bindings');
export const AttachmentConfig = new Model('attachment_config');
// The relational reader remains for historical-record regressions/import checks.
// The native host always selects the separately versioned instance AFS object.
export const getAttachmentConfig = async () => {
  if (value('DIDMAIL_CONFIG_BACKEND') === 'afs') {
    const { readInstanceAttachmentConfig } = await import('../config/instance-config');
    return readInstanceAttachmentConfig();
  }
  return (
    await AttachmentConfig.findOrCreate({
      where: { id: 1 },
      defaults: { maxFileSizeBytes: 10485760, maxFileCount: 5, pricePerBytePerDay: '0' },
    })
  )[0];
};
export const setAttachmentConfig = async (updates: Values) => (await getAttachmentConfig()).update(updates);
export const getDatabaseSize = async () => {
  const row = await bindings.DB.prepare(
    'SELECT page_count * page_size AS size FROM pragma_page_count(), pragma_page_size()',
  ).first<{ size: number }>();
  return `${((row?.size ?? 0) / 1024).toFixed(2)} KB`;
};
export default { authenticate: () => bindings.DB.prepare('SELECT 1').first() };
