import path from 'node:path';

const env = process.env;
const int = (v: string | undefined, d: number) => (v ? parseInt(v, 10) : d);

/** Toda la configuración sale de variables de entorno (ver .env.example). */
export const config = {
  env: env.NODE_ENV ?? 'development',
  port: int(env.PORT, 8000),
  databaseUrl: env.DATABASE_URL ?? 'postgres://sportryn:sportryn@localhost:5433/sportryn',
  /** URL pública del frontend (para volver tras el pago). */
  appUrl: env.APP_URL ?? 'http://localhost:3000',
  /** URL pública de esta API (para construir enlaces a fotos y stickers). */
  apiUrl: env.API_URL ?? 'http://localhost:8000',
  corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:3000,capacitor://localhost,https://localhost,http://localhost')
    .split(',').map((s) => s.trim()).filter(Boolean),
  timezone: env.APP_TIMEZONE ?? 'Europe/Madrid',
  /** 'fake' = pago simulado en local. 'stripe' = Stripe Checkout real (o modo test). */
  paymentsDriver: (env.PAYMENTS_DRIVER ?? 'fake') as 'fake' | 'stripe',
  stripeSecretKey: env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
  mediaDir: path.resolve(env.MEDIA_DIR ?? 'storage/media'),
  maxUploadBytes: int(env.MAX_UPLOAD_MB, 8) * 1024 * 1024,
  log: env.LOG === '1' || (env.NODE_ENV !== 'test' && env.LOG !== '0'),
  rateLimits: {
    login: int(env.RL_LOGIN, 10),
    register: int(env.RL_REGISTER, 10),
    registrations: int(env.RL_REGISTRATIONS, 20),
    waitlist: int(env.RL_WAITLIST, 5),
  },
};
