/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Where the dev server forwards /api and /hubs. Overridable so a test run can point at its own API and never at whatever happens to be on 5284.
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:5284';

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
        target: proxyTarget,
        changeOrigin: true,
      },
      '/hubs': {
        target: proxyTarget,
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
