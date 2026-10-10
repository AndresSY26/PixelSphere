import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_er3MTsNQHI6W@ep-soft-cake-b53dbtwh-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

export const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    console.error(`[PostgreSQL Query Error] Query: "${text}"`, error);
    throw error;
  }
}

export async function initDatabase() {
  console.log('[PostgreSQL] Conectando e inicializando tablas en Neon PostgreSQL (Cuota 3GB Unificada)...');

  // 1. Crear tablas base si no existen
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(32) DEFAULT 'user',
      plan VARCHAR(32) DEFAULT 'free',
      avatar_url TEXT,
      is_2fa_enabled BOOLEAN DEFAULT FALSE,
      two_fa_secret TEXT,
      auth_provider VARCHAR(32) DEFAULT 'local',
      is_google_linked BOOLEAN DEFAULT FALSE,
      storage_quota BIGINT DEFAULT 3221225472,
      storage_used BIGINT DEFAULT 0,
      vault_password_hash TEXT,
      settings JSONB DEFAULT '{}'::jsonb,
      filter_preferences JSONB DEFAULT '{}'::jsonb,
      video_progress JSONB DEFAULT '{}'::jsonb,
      sessions JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS albums (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      parent_id VARCHAR(64) REFERENCES albums(id) ON DELETE CASCADE,
      cover_media_id VARCHAR(64),
      is_public BOOLEAN DEFAULT FALSE,
      shared_with JSONB DEFAULT '[]'::jsonb,
      media_ids JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS media (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255),
      mime_type VARCHAR(128),
      type VARCHAR(32) NOT NULL,
      size BIGINT DEFAULT 0,
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      width INT,
      height INT,
      duration FLOAT,
      is_adult_content BOOLEAN DEFAULT FALSE,
      nsfw_score FLOAT DEFAULT 0,
      tags JSONB DEFAULT '[]'::jsonb,
      visual_tags JSONB DEFAULT '[]'::jsonb,
      description TEXT,
      album_id VARCHAR(64),
      album_ids JSONB DEFAULT '[]'::jsonb,
      shared_with JSONB DEFAULT '[]'::jsonb,
      is_shared BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMPTZ,
      source VARCHAR(64),
      camera VARCHAR(128),
      cloud_storage_path TEXT,
      cloud_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS view_history (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
      media_id VARCHAR(64) REFERENCES media(id) ON DELETE CASCADE,
      source VARCHAR(128) DEFAULT 'Galería Principal',
      device_name VARCHAR(128) DEFAULT 'Escritorio',
      client_ip VARCHAR(64) DEFAULT '127.0.0.1',
      viewed_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
      badge_id VARCHAR(64) NOT NULL,
      unlocked_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_user_badge UNIQUE (user_id, badge_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(32) NOT NULL,
      billing_cycle VARCHAR(32) NOT NULL DEFAULT 'monthly',
      amount_usd NUMERIC(10, 2) NOT NULL,
      currency VARCHAR(8) DEFAULT 'USD',
      payment_method VARCHAR(64) DEFAULT 'google_pay',
      google_transaction_id TEXT,
      token_details JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(32) DEFAULT 'completed',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2. Garantizar que todas las columnas adicionales existan antes de indexar
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(32) DEFAULT 'free';").catch(() => {});
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_quota BIGINT DEFAULT 3221225472;").catch(() => {});
  await query("ALTER TABLE users ALTER COLUMN storage_quota SET DEFAULT 3221225472;").catch(() => {});
  await query("ALTER TABLE media ADD COLUMN IF NOT EXISTS cloud_storage_path TEXT;").catch(() => {});
  await query("ALTER TABLE media ADD COLUMN IF NOT EXISTS cloud_url TEXT;").catch(() => {});
  await query("ALTER TABLE media ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);").catch(() => {});

  // 3. Crear índices optimizados
  await query('CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_media_deleted ON media(is_deleted);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_media_user_deleted ON media(user_id, is_deleted);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_media_hash ON media(file_hash);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_albums_user ON albums(user_id);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_albums_parent ON albums(parent_id);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_history_user ON view_history(user_id);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);').catch(() => {});

  // 4. Normalizar y forzar cuota de almacenamiento a 3 GB (3,221,225,472 B) para usuarios gratuitos
  await query(`
    UPDATE users 
    SET storage_quota = 3221225472, plan = COALESCE(plan, 'free')
    WHERE (plan = 'free' OR plan IS NULL OR storage_quota != 3221225472) 
      AND (plan NOT IN ('pro', 'ultra'));
  `).catch((err) => console.warn('[PostgreSQL] Advertencia actualizando cuotas a 3GB:', err.message));

  // 5. Reconciliar almacenamiento usado real para máxima precisión
  await query(`
    UPDATE users u 
    SET storage_used = COALESCE(
      (SELECT SUM(size) FROM media m WHERE m.user_id = u.id AND m.is_deleted = false), 
      0
    );
  `).catch(() => {});

  console.log('[PostgreSQL] Tablas, cuota de 3GB e índices optimizados verificados en Neon PostgreSQL.');
}
