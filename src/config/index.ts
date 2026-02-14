import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const configSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  apiKey: z.string().min(1, 'API_KEY is required'),
  allowedPhones: z.array(z.string()).min(1, 'At least one phone number must be allowed'),
  authDir: z.string().default('./auth_info'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

function parseAllowedPhones(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((phone) => phone.trim())
    .filter((phone) => phone.length > 0);
}

function loadConfig(): Config {
  const rawConfig = {
    port: process.env.PORT,
    apiKey: process.env.API_KEY,
    allowedPhones: parseAllowedPhones(process.env.ALLOWED_PHONES),
    authDir: process.env.AUTH_DIR,
    logLevel: process.env.LOG_LEVEL,
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

export const config = loadConfig();

export function normalizePhoneToJid(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  return `${digits}@s.whatsapp.net`;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

export function isPhoneAllowed(phone: string): boolean {
  const normalizedInput = normalizePhone(phone);
  return config.allowedPhones.some(
    (allowed) => normalizePhone(allowed) === normalizedInput
  );
}
