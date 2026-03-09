import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 3000,
  },
  base: '/v-slot/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
