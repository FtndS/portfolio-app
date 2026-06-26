import pool from './index.js'
import { rebuildHoldingsFromTransactions } from '../lib/holdingSync.js'

const migrations = [
  {
    name: '001_phase3_portfolios',
    sql: `
      CREATE TABLE IF NOT EXISTS portfolios (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        currency VARCHAR(3) DEFAULT 'USD',
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id SERIAL PRIMARY KEY,
        portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        snapshot_date DATE NOT NULL,
        total_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
        total_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        sector_data JSONB DEFAULT '[]',
        UNIQUE (portfolio_id, snapshot_date)
      );

      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'holdings') THEN
          ALTER TABLE holdings ADD COLUMN IF NOT EXISTS portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE;
          ALTER TABLE holdings ADD COLUMN IF NOT EXISTS market VARCHAR(20) DEFAULT 'US';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal') THEN
          ALTER TABLE journal ADD COLUMN IF NOT EXISTS portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `
  },
  {
    name: '002_phase3_backfill_portfolios',
    sql: `
      DO $$
      DECLARE
        h_rec RECORD;
        usr_rec RECORD;
        pid INTEGER;
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'holdings') THEN
          FOR h_rec IN SELECT DISTINCT user_id FROM holdings WHERE portfolio_id IS NULL
          LOOP
            INSERT INTO portfolios (user_id, name, is_default)
            VALUES (h_rec.user_id, 'Main Portfolio', true)
            RETURNING id INTO pid;
            UPDATE holdings SET portfolio_id = pid WHERE user_id = h_rec.user_id AND portfolio_id IS NULL;
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
              UPDATE transactions SET portfolio_id = pid WHERE user_id = h_rec.user_id AND portfolio_id IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal') THEN
              UPDATE journal SET portfolio_id = pid WHERE user_id = h_rec.user_id AND portfolio_id IS NULL;
            END IF;
          END LOOP;
        END IF;

        FOR usr_rec IN
          SELECT users.id AS user_id FROM users
          WHERE NOT EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = users.id)
        LOOP
          INSERT INTO portfolios (user_id, name, is_default)
          VALUES (usr_rec.user_id, 'Main Portfolio', true);
        END LOOP;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
          UPDATE transactions t SET portfolio_id = (
            SELECT id FROM portfolios p WHERE p.user_id = t.user_id ORDER BY is_default DESC, id ASC LIMIT 1
          ) WHERE portfolio_id IS NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal') THEN
          UPDATE journal j SET portfolio_id = (
            SELECT id FROM portfolios p WHERE p.user_id = j.user_id ORDER BY is_default DESC, id ASC LIMIT 1
          ) WHERE portfolio_id IS NULL;
        END IF;
      END $$;
    `
  },
  {
    name: '003_repair_null_portfolio_ids',
    sql: `
      UPDATE holdings h SET portfolio_id = (
        SELECT id FROM portfolios p WHERE p.user_id = h.user_id ORDER BY is_default DESC, id ASC LIMIT 1
      ) WHERE portfolio_id IS NULL AND EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = h.user_id);

      UPDATE transactions t SET portfolio_id = (
        SELECT id FROM portfolios p WHERE p.user_id = t.user_id ORDER BY is_default DESC, id ASC LIMIT 1
      ) WHERE portfolio_id IS NULL AND EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = t.user_id);

      UPDATE journal j SET portfolio_id = (
        SELECT id FROM portfolios p WHERE p.user_id = j.user_id ORDER BY is_default DESC, id ASC LIMIT 1
      ) WHERE portfolio_id IS NULL AND EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = j.user_id);
    `
  },
  {
    name: '005_auth_security_columns',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(64);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
        ON users (LOWER(email));

      CREATE UNIQUE INDEX IF NOT EXISTS users_password_reset_token_idx
        ON users (password_reset_token)
        WHERE password_reset_token IS NOT NULL;
    `
  },
  {
    name: '007_strict_portfolio_isolation',
    sql: `
      -- Backfill any rows still missing portfolio_id
      UPDATE holdings h SET portfolio_id = (
        SELECT id FROM portfolios p WHERE p.user_id = h.user_id ORDER BY is_default DESC, id ASC LIMIT 1
      ) WHERE portfolio_id IS NULL AND EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = h.user_id);

      UPDATE transactions t SET portfolio_id = (
        SELECT id FROM portfolios p WHERE p.user_id = t.user_id ORDER BY is_default DESC, id ASC LIMIT 1
      ) WHERE portfolio_id IS NULL AND EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = t.user_id);

      UPDATE journal j SET portfolio_id = (
        SELECT id FROM portfolios p WHERE p.user_id = j.user_id ORDER BY is_default DESC, id ASC LIMIT 1
      ) WHERE portfolio_id IS NULL AND EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = j.user_id);

      -- Re-link rows pointing at deleted portfolios
      UPDATE holdings h SET portfolio_id = (
        SELECT id FROM portfolios p WHERE p.user_id = h.user_id ORDER BY is_default DESC, id ASC LIMIT 1
      ) WHERE portfolio_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM portfolios p WHERE p.id = h.portfolio_id AND p.user_id = h.user_id)
        AND EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = h.user_id);

      UPDATE transactions t SET portfolio_id = (
        SELECT id FROM portfolios p WHERE p.user_id = t.user_id ORDER BY is_default DESC, id ASC LIMIT 1
      ) WHERE portfolio_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM portfolios p WHERE p.id = t.portfolio_id AND p.user_id = t.user_id)
        AND EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = t.user_id);

      UPDATE journal j SET portfolio_id = (
        SELECT id FROM portfolios p WHERE p.user_id = j.user_id ORDER BY is_default DESC, id ASC LIMIT 1
      ) WHERE portfolio_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM portfolios p WHERE p.id = j.portfolio_id AND p.user_id = j.user_id)
        AND EXISTS (SELECT 1 FROM portfolios p WHERE p.user_id = j.user_id);

      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'holdings' AND column_name = 'portfolio_id' AND is_nullable = 'YES') THEN
          ALTER TABLE holdings ALTER COLUMN portfolio_id SET NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'transactions' AND column_name = 'portfolio_id' AND is_nullable = 'YES') THEN
          ALTER TABLE transactions ALTER COLUMN portfolio_id SET NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'journal' AND column_name = 'portfolio_id' AND is_nullable = 'YES') THEN
          ALTER TABLE journal ALTER COLUMN portfolio_id SET NOT NULL;
        END IF;
      END $$;
    `,
    async after() {
      await rebuildHoldingsFromTransactions(pool)
    },
  },
  {
    name: '008_thai_market_backfill',
    sql: `
      UPDATE holdings SET market = 'SET'
      WHERE currency = 'THB' AND (market IS NULL OR market = 'US');

      UPDATE holdings SET market = 'HK'
      WHERE currency = 'HKD' AND (market IS NULL OR market = 'US');

      UPDATE holdings SET sector = 'Other'
      WHERE currency = 'THB' AND market = 'SET';
    `,
  },
  {
    name: '009_repair_thai_holdings_metadata',
    sql: `
      UPDATE holdings SET sector = 'Other'
      WHERE name ~ '^[0-9]+$';
    `,
  },
  {
    name: '010_email_otp',
    sql: `
      CREATE TABLE IF NOT EXISTS email_otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        purpose VARCHAR(32) NOT NULL,
        otp_hash VARCHAR(64) NOT NULL,
        meta JSONB DEFAULT '{}',
        attempts INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS email_otps_email_purpose_idx
        ON email_otps (email, purpose);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT true;
      UPDATE users SET email_verified = true WHERE email_verified IS NULL;
    `,
  },
  {
    name: '011_fix_thai_holding_currency',
    sql: `
      UPDATE holdings SET currency = 'THB', market = 'SET'
      WHERE (
        ticker ILIKE '%-BK' OR ticker ILIKE '%.BK'
      ) AND COALESCE(currency, 'USD') = 'USD';
    `,
  },
]

export async function runMigrations() {
  const errors = []
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  for (const m of migrations) {
    const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [m.name])
    if (exists.rows.length) continue
    try {
      await pool.query('BEGIN')
      await pool.query(m.sql)
      if (m.after) await m.after()
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [m.name])
      await pool.query('COMMIT')
      console.log(`Migration applied: ${m.name}`)
    } catch (err) {
      await pool.query('ROLLBACK').catch(() => {})
      console.error(`Migration failed: ${m.name}`, err.message)
      errors.push({ name: m.name, error: err.message })
    }
  }
  return errors
}
