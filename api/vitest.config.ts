import { defineConfig } from 'vitest/config';
import os from 'node:os';
import path from 'node:path';

// Entorno de test: BD aparte, pagos simulados y límites bajos para probar el rate limit.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://sportryn:sportryn@db:5432/sportryn_test',
  PAYMENTS_DRIVER: 'fake',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  MEDIA_DIR: path.join(os.tmpdir(), 'sportryn-test-media'),
  MAX_UPLOAD_MB: '1',
  RL_LOGIN: '5', RL_REGISTER: '25', RL_REGISTRATIONS: '12', RL_WAITLIST: '3',
});

export default defineConfig({
  test: {
    fileParallelism: false, // todos los archivos comparten la misma BD de test
    globalSetup: './tests/global-setup.ts',
    testTimeout: 20000,
    coverage: {
      provider: 'v8', include: ['src/**'], exclude: ['src/server.ts'],
      thresholds: { lines: 80, statements: 80 },
    },
  },
});
