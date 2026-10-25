import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { cpSync } from 'node:fs';
import { manifest } from './manifest.config.ts';

// Popup (React) + background service worker. The content script is built
// separately (vite.content.config.ts) because it must be one classic script.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'pandascrow-extension-files',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(manifest(mode), null, 2) });
      },
      closeBundle() {
        cpSync(resolve(import.meta.dirname, 'images/icons'), resolve(import.meta.dirname, 'dist/icons'), { recursive: true });
      },
    },
  ],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  base: '',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode !== 'development',
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'popup.html'),
        background: resolve(import.meta.dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
}));
