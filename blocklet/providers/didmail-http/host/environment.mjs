// One immutable application environment per ARC process. Legacy signing modules
// cache the node wallet; a second instance must never inherit that identity.
let environment;
const target = Object.create(null);
export function configureEnvironment(value) {
  if (environment) throw Error('DIDMail protocol environment is already configured');
  Object.assign(target, value);
  environment = Object.freeze(target);
}
export const env = new Proxy(
  target,
  {
    get(_target, key) {
      if (!environment) throw Error('DIDMail protocol environment is unavailable');
      return environment[key];
    },
  },
);
