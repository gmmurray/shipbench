import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  const shared = {
    plugins: [react(), tailwindcss()],
  };

  if (command === 'serve') {
    return shared;
  }

  // The package build cleans dist once, before running both Vite configs.
  // Neither config may empty the shared directory or it would erase the
  // other output.
  return {
    ...shared,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(__dirname, 'standalone.html'),
      },
    },
  };
});
