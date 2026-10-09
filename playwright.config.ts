import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/vrt',
  outputDir: 'test-results',
  // Astro 7 (Vite 8) のdevサーバーは起動直後、依存関係の再最適化が完了すると
  // クライアントへ full-reload を送ることがある。最初のテストがこれと競合して
  // "Execution context was destroyed" で落ちることがあるため、CI では1回だけ
  // リトライして吸収する（実際のスクリーンショット差分検知には影響しない）。
  retries: process.env.CI ? 1 : 0,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:4321',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
