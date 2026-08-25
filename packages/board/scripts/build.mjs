import { rm } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(packageRoot, 'dist');

if (relative(packageRoot, distDir) !== 'dist') {
  throw new Error(`Refusing to clean unexpected output path: ${distDir}`);
}

// Clean exactly once, then let both builds write non-overlapping artifacts to
// the shared directory. A config-level emptyOutDir would make either build able
// to silently delete the other one.
await rm(distDir, { recursive: true, force: true });

await build({
  root: packageRoot,
  configFile: resolve(packageRoot, 'vite.config.ts'),
});

await build({
  root: packageRoot,
  configFile: resolve(packageRoot, 'vite.lib.config.ts'),
});
