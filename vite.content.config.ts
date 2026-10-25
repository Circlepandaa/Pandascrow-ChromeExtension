import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Content scripts can't be ES modules: build one self-contained IIFE.
export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: mode === 'development' ? 'inline' : false,
    minify: mode !== 'development',
    lib: { entry: resolve(import.meta.dirname, 'src/content/index.ts'), formats: ['iife'], name: 'PandascrowContent', fileName: () => 'content.js' },
  },
}));
