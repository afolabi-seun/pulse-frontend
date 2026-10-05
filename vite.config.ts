/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5284',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5284',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Do NOT ship readable sourcemaps to production — they expose the full original
    // source (and any in-bundle strings) via DevTools. Default to none. Set
    // BUILD_SOURCEMAP=true in CI to emit "hidden" maps (generated but not referenced
    // by the JS) for uploading to an error tracker; those must not be served publicly.
    sourcemap: process.env.BUILD_SOURCEMAP === 'true' ? 'hidden' : false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Keep Vitest to unit/component tests under src; Playwright owns ./e2e.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
