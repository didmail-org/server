import { Sequelize, DataTypes, QueryTypes } from 'sequelize';
import path from 'path';
import env from './env';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(env.dataDir, 'didmail.sqlite'),
  hooks: {
    // Optional SQLite FK enforcement; destroyMailWithAttachments remains the primary guarantee.
    afterConnect: async (connection: { run: (sql: string, cb: (err: Error | null) => void) => void }) => {
      await new Promise<void>((resolve, reject) => {
        connection.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    },
  },
});

const Contact = sequelize.define(
  'contact',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sender: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    receiver: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contact: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    namecard: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    preparedOrigin: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sendStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'review',
    },
    hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    paymentTx: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    assetTx: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    asset: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    credit: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dividend: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'contacts',
    timestamps: true,
  },
);

const Mail = sequelize.define(
  'mail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    sender: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    receiver: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    envelope: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    paymentTx: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    assetTx: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    asset: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    credit: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dividend: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expiredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    downloadAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    preparedOrigin: { type: DataTypes.TEXT, allowNull: true },
    sendStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'prepared' },
    totalAttachmentSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    attachmentCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    attachmentStorageCost: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '0',
    },
  },
  {
    tableName: 'mails',
    timestamps: true,
  },
);

const Envelope = sequelize.define(
  'envelope',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'public' },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    retentionPeriod: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    svg: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  {
    tableName: 'envelopes',
    timestamps: true,
  },
);

const Namecard = sequelize.define(
  'namecard',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'public' },
    price: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    svg: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  {
    tableName: 'namecards',
    timestamps: true,
  },
);

const AttachmentConfig = sequelize.define(
  'AttachmentConfig',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    maxFileSizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10 * 1024 * 1024,
    },
    maxFileCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    pricePerBytePerDay: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: 'attachment_config',
    timestamps: true,
  },
);

const Attachment = sequelize.define(
  'Attachment',
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    mailId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    encryptedName: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    encryptedMime: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.BLOB,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: 'attachments',
    timestamps: true,
    indexes: [{ fields: ['mailId'] }],
  },
);

const Alias = sequelize.define(
  'alias',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    alias: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    aliasHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    domain: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    owner: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ownerPk: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    preparedOrigin: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assetAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mintTx: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    burnTx: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bindingProof: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    nonce: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // 注册价格（TBA wei），buildRegisterTx 时写入 pending 行，finalizeRegister 广播前校验支付
    price: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // pending / active / grace / released / burned
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
    },
  },
  {
    tableName: 'aliases',
    timestamps: true,
    indexes: [{ unique: true, fields: ['alias', 'domain'] }, { fields: ['owner'] }, { fields: ['aliasHash'] }],
  },
);

const DomainBinding = sequelize.define(
  'domain_binding',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // punycode lowercase
    domain: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    // pending / verified / grace / unbound
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    challenge: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    domainKeyEnc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    verifiedAt: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    lastCheckedAt: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    graceUntil: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // TBA wei
    aliasPrice: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0',
    },
    renewPricePerYear: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0',
    },
    minLength: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4,
    },
    maxLength: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 32,
    },
  },
  {
    tableName: 'domain_bindings',
    timestamps: true,
  },
);

const migrateContactsTable = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('contacts');
  if (!columns.preparedOrigin)
    await queryInterface.addColumn('contacts', 'preparedOrigin', { type: DataTypes.TEXT, allowNull: true });
  if (!columns.sendStatus) {
    await queryInterface.addColumn('contacts', 'sendStatus', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'review',
    });
    await sequelize.query("UPDATE contacts SET sendStatus = 'sent' WHERE asset IS NOT NULL AND asset != ''");
  }
};

const migrateAliasesTable = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('aliases');
  if (!columns.preparedOrigin)
    await queryInterface.addColumn('aliases', 'preparedOrigin', { type: DataTypes.TEXT, allowNull: true });
};

const migrateMailsTable = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('mails');

  if (!columns.preparedOrigin) {
    await queryInterface.addColumn('mails', 'preparedOrigin', { type: DataTypes.TEXT, allowNull: true });
  }
  if (!columns.sendStatus) {
    await queryInterface.addColumn('mails', 'sendStatus', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'prepared',
    });
    await sequelize.query("UPDATE mails SET sendStatus = 'sent' WHERE asset IS NOT NULL AND asset != ''");
    await sequelize.query(
      "UPDATE mails SET sendStatus = 'review' WHERE (asset IS NULL OR asset = '') AND (paymentTx IS NOT NULL OR assetTx IS NOT NULL)",
    );
  }

  if (!columns.totalAttachmentSize) {
    await queryInterface.addColumn('mails', 'totalAttachmentSize', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
  }

  if (!columns.attachmentCount) {
    await queryInterface.addColumn('mails', 'attachmentCount', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
  }

  if (!columns.attachmentStorageCost) {
    await queryInterface.addColumn('mails', 'attachmentStorageCost', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '0',
    });
  }
};

const ATTACHMENT_CONFIG_DEFAULTS = {
  id: 1,
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFileCount: 5,
  pricePerBytePerDay: '0',
};

type AttachmentConfigUpdates = Partial<{
  maxFileSizeBytes: number;
  maxFileCount: number;
  pricePerBytePerDay: string;
}>;

const getAttachmentConfig = async () => {
  const [config] = await AttachmentConfig.findOrCreate({
    where: { id: 1 },
    defaults: ATTACHMENT_CONFIG_DEFAULTS,
  });
  return config;
};

const setAttachmentConfig = async (updates: AttachmentConfigUpdates) => {
  const config = await getAttachmentConfig();
  await config.update({
    ...updates,
    updatedAt: new Date(),
  });
  return config;
};

const getDatabaseSize = async () => {
  const results = await sequelize.query(
    `
    SELECT 
      page_count * page_size as size
    FROM 
      pragma_page_count(), 
      pragma_page_size();
  `,
    { type: QueryTypes.SELECT },
  );

  const row = results[0] as { size: number };
  const sizeInBytes = row.size;

  let size: number;
  let unit: string;

  if (sizeInBytes < 1024) {
    size = sizeInBytes;
    unit = 'B';
  } else if (sizeInBytes < 1024 * 1024) {
    size = sizeInBytes / 1024;
    unit = 'KB';
  } else if (sizeInBytes < 1024 * 1024 * 1024) {
    size = sizeInBytes / (1024 * 1024);
    unit = 'MB';
  } else {
    size = sizeInBytes / (1024 * 1024 * 1024);
    unit = 'GB';
  }

  return `${size.toFixed(2)} ${unit}`;
};

export {
  Mail,
  Envelope,
  Namecard,
  Contact,
  AttachmentConfig,
  Attachment,
  Alias,
  DomainBinding,
  migrateMailsTable,
  migrateContactsTable,
  migrateAliasesTable,
  getAttachmentConfig,
  setAttachmentConfig,
  getDatabaseSize,
};

export default sequelize;
