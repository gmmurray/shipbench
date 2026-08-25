import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  version: string;
};

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node20',
  // Bundle @shipbench/core into the CLI binary. Without this, the runtime
  // would try to load core's `.ts` source files (its exports point at src
  // during dev) and Node would reject them.
  noExternal: ['@shipbench/core'],
  clean: true,
  // gray-matter (transitive via core) is CJS. Inject createRequire so its
  // require('fs') calls work inside our ESM bundle.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  // Inject the version from package.json so we have a single source of truth.
  define: {
    __SHIPBENCH_VERSION__: JSON.stringify(pkg.version),
  },
});
