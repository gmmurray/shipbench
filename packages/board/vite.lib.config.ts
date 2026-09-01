import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // public/ holds the standalone app's favicon. The standalone build already
  // copied it; a library has no use for it and should not re-emit it.
  publicDir: false,
  build: {
    outDir: 'dist',
    // dist also contains the standalone app consumed by the CLI. The package
    // build owns the one clean that happens before either Vite build runs.
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'styles',
    },
    rollupOptions: {
      // Hosts must provide one React instance. Include the subpaths generated
      // by the JSX transform and createRoot so they cannot be bundled either.
      external: [/^react(?:\/.*)?$/, /^react-dom(?:\/.*)?$/],
    },
  },
});
