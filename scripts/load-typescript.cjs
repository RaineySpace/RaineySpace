// Run source-level checks with the TypeScript compiler already used by Next.js.
// This hook is only installed in build/validation/test scripts, never in the site.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  module._compile(outputText, filename);
};

module.exports = (filename) => require(path.resolve(__dirname, '..', filename));
