import sequelize, {
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
} from '../libs/sqlite';

// eslint-disable-next-line import/prefer-default-export
export async function initializeDatabase() {
  await sequelize.authenticate();
  await Mail.sync();
  await migrateMailsTable();
  for (const model of [Attachment, Envelope, Namecard, Contact, Alias, DomainBinding, AttachmentConfig]) {
    // Keep schema initialization ordered before serving requests.
    // eslint-disable-next-line no-await-in-loop
    await model.sync();
  }
  await migrateContactsTable();
  await migrateAliasesTable();
}
