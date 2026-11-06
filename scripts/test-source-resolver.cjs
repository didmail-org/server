// Only Node unit tests substitute legacy filesystem/SQLite/identity ports.
// Production modules and the AFS business fixture use physical package imports.
const path = require('node:path');
const fs = require('node:fs');
const ports = require('../tests/node-adapters.json');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'blocklet/providers/didmail-http/source');
const adapters = new Map(
  Object.entries(ports).map(([native, adapter]) => [
    fs.realpathSync(path.join(source, native)), path.join(root, adapter),
  ]),
);
module.exports = (request, options) => {
  const resolved = options.defaultResolver(request, options);
  return adapters.get(resolved) || resolved;
};
