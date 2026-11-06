export const protocolConfigPath = '/instance/app/didmail/private/protocol-runtime.json';
export const allowedVariables = new Set([
  'CHAIN_ID',
  'CHAIN_HOST',
  'LOCAL_TOKEN_ID',
  'SERVER_NODE_FACTORY',
  'FACTORY_OWNER',
  'MAIL_FACTORY',
  'ENVELOPE_FACTORY',
  'NAMECARD_FACTORY',
  'CONTACT_FACTORY',
  'ALIAS_FACTORY',
  'DIDMAIL_MEMBER_ACCESS',
  'DIDMAIL_ARC_INSTANCE_ID',
  'MAIL_PRICE',
  'CONTACT_PRICE',
  'DIDMAIL_ACCOUNT_LINKS_ENABLED',
  'DIDMAIL_ACCOUNT_ORIGIN',
  'ARC_CHAIN_PATH',
  'ARC_CHAIN_ENDPOINT',
  'DMP_INTERNAL_RETENTION_DAYS',
  'DMP_CONFIRMATION_POLICY',
  'DMP_INDEFINITE_PRICE_PER_BYTE',
  'DMP_STORAGE_PRICE_PER_BYTE_PER_DAY',
  'TOKEN_SYMBOL',
]);
export function validateProtocolConfig(config) {
  const invalid = () => {
    throw Error('Invalid private DIDMail protocol configuration');
  };
  if (
    !config ||
    config.schemaVersion !== 1 ||
    typeof config.enabled !== 'boolean' ||
    Object.keys(config).some(
      (key) =>
        ![
          'schemaVersion',
          'enabled',
          'publicOrigin',
          'arcOrigin',
          'listenHost',
          'listenPort',
          'aliases',
          'jobsIntervalSeconds',
          'vars',
          'secrets',
        ].includes(key),
    )
  )
    invalid();
  for (const [key, local] of [
    ['publicOrigin', false],
    ['arcOrigin', true],
  ]) {
    const url = new URL(config[key]);
    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !(
        url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          (local || url.hostname.endsWith('.localhost') || ['localhost', '127.0.0.1'].includes(url.hostname)))
      ) ||
      (local && (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)))
    )
      invalid();
  }
  if (
    !Number.isInteger(config.listenPort) ||
    config.listenPort < 1 ||
    config.listenPort > 65535 ||
    !['127.0.0.1', '0.0.0.0'].includes(config.listenHost) ||
    typeof config.aliases !== 'string' ||
    !Number.isInteger(config.jobsIntervalSeconds) ||
    (config.jobsIntervalSeconds !== 0 && (config.jobsIntervalSeconds < 5 || config.jobsIntervalSeconds > 3600))
  )
    invalid();
  if (
    !config.vars ||
    Object.entries(config.vars).some(
      ([key, value]) => !allowedVariables.has(key) || typeof value !== 'string' || value.length > 4096,
    )
  )
    invalid();
  if (!['arc', 'legacy'].includes(config.vars.DIDMAIL_MEMBER_ACCESS)) invalid();
  if (
    !config.secrets ||
    Object.keys(config.secrets).some(
      (key) => !['NODE_SECRET_KEY', 'NODE_ADDRESS', 'ARC_MEMBERS_TOKEN'].includes(key),
    ) ||
    !/^0x[\da-f]{64}([\da-f]{64})?$/i.test(config.secrets.NODE_SECRET_KEY) ||
    typeof config.secrets.NODE_ADDRESS !== 'string' ||
    !config.secrets.NODE_ADDRESS ||
    Object.values(config.secrets).some(
      (value) => typeof value !== 'string' || value.length > 4096 || /[\r\n]/.test(value),
    )
  )
    invalid();
  return config;
}
