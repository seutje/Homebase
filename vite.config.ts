import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1437,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/.qa/**', '**/.playwright-cli/**'] },
  },
  clearScreen: false,
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
});
