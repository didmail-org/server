// The package owns shared source. Node-only legacy adapters remain outside the
// artifact; unit tests resolve those adapters in the repository's virtual tree.
const path = require('node:path');
const fs = require('node:fs');
module.exports = (request, options) => {
  const marker = path.join('blocklet', 'providers', 'didmail-http', 'source') + path.sep;
  if (request.startsWith('.') && options.basedir.includes(marker)) {
    const root = options.basedir.slice(0, options.basedir.indexOf(marker));
    const relative = options.basedir.slice(options.basedir.indexOf(marker) + marker.length);
    const candidate = path.resolve(root, relative, request);
    if (
      [candidate, candidate + '.ts', candidate + '.mjs', candidate + '.js', path.join(candidate, 'index.ts')].some(
        (file) => fs.existsSync(file),
      )
    )
      return options.defaultResolver(candidate, options);
  }
  return options.defaultResolver(request, options);
};
