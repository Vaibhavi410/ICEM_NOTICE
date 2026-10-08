import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export function resolveJwtSecrets(
  nodeEnv: string,
  accessSecret: string | undefined,
  refreshSecret: string | undefined
): { JWT_SECRET: string; JWT_REFRESH_SECRET: string } {
  const isProduction = nodeEnv.toLowerCase() === 'production';
  if (isProduction && (!accessSecret?.trim() || !refreshSecret?.trim())) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be configured in production');
  }

  return {
    JWT_SECRET: accessSecret || 'icem-notice-jwt-super-secret-key-change-in-production',
    JWT_REFRESH_SECRET: refreshSecret || 'icem-notice-jwt-refresh-super-secret-key-change-in-production',
  };
}

export function validateProductionConfig(
  nodeEnv: string,
  config: {
    DATABASE_URL: string | undefined;
    JWT_SECRET: string | undefined;
    JWT_REFRESH_SECRET: string | undefined;
    SUPABASE_URL: string | undefined;
    SUPABASE_SERVICE_ROLE_KEY: string | undefined;
    SUPABASE_STORAGE_BUCKET: string | undefined;
  }
): void {
  if (nodeEnv.toLowerCase() !== 'production') {
    return;
  }

  const missing = Object.entries(config)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Required production configuration is missing: ${missing.join(', ')}`);
  }
}

const NODE_ENV = process.env.NODE_ENV || 'development';
validateProductionConfig(NODE_ENV, {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
});

const jwtSecrets = resolveJwtSecrets(
  NODE_ENV,
  process.env.JWT_SECRET,
  process.env.JWT_REFRESH_SECRET
);

export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: jwtSecrets.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_SECRET: jwtSecrets.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CLIENT_URLS: process.env.CLIENT_URLS
    ? process.env.CLIENT_URLS.split(',').map((url) => url.trim())
    : ['http://localhost:5173', 'http://localhost:5174'],
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '15', 10),
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '',
  SUPABASE_URL:
    process.env.SUPABASE_URL ||
    (NODE_ENV === 'production' ? '' : 'https://xhxxcautdoyozbrejdsm.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_STORAGE_BUCKET:
    process.env.SUPABASE_STORAGE_BUCKET || (NODE_ENV === 'production' ? '' : 'notice-attachments'),
};
