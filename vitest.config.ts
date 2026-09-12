import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/*.ts',
        'src/storage/*.ts',
        'src/App.tsx',
        'src/pwa/*.ts',
        'src/analytics.ts',
        'src/usePuzzleTime.ts',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        'src/domain/*.ts': { branches: 90, lines: 95 },
        'src/storage/*.ts': { branches: 90, lines: 95 },
      },
    },
  },
});
