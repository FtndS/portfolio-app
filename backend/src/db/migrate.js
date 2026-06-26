import pool from './index.js'

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
    name: '004_seed_known_sectors',
    sql: `
      UPDATE holdings SET sector = 'Technology', name = 'NVIDIA Corporation'
        WHERE ticker = 'NVDA' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Financial Services', name = 'Berkshire Hathaway Inc.'
        WHERE ticker = 'BRK-B' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'ETF — US Large Cap', name = 'Vanguard S&P 500 ETF'
        WHERE ticker = 'VOO' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'ETF — US Growth', name = 'Invesco NASDAQ 100 ETF'
        WHERE ticker = 'QQQM' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'ETF — Semiconductors', name = 'VanEck Semiconductor ETF'
        WHERE ticker = 'SMH' AND (sector IS NULL OR sector = 'Other');
    `
  },
  {
    name: '006_backfill_known_sectors',
    sql: `
      UPDATE holdings SET sector = 'Healthcare', name = 'Eli Lilly and Company'
        WHERE ticker = 'LLY' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Technology', name = 'Taiwan Semiconductor Manufacturing'
        WHERE ticker = 'TSM' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Healthcare', name = 'Johnson & Johnson'
        WHERE ticker = 'JNJ' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Healthcare', name = 'UnitedHealth Group'
        WHERE ticker = 'UNH' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Technology', name = 'Apple Inc.'
        WHERE ticker = 'AAPL' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Technology', name = 'Microsoft Corporation'
        WHERE ticker = 'MSFT' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Technology', name = 'Advanced Micro Devices'
        WHERE ticker = 'AMD' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Financial Services', name = 'JPMorgan Chase'
        WHERE ticker = 'JPM' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Consumer Cyclical', name = 'Amazon.com Inc.'
        WHERE ticker = 'AMZN' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Communication Services', name = 'Alphabet Inc.'
        WHERE ticker IN ('GOOGL', 'GOOG') AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Communication Services', name = 'Meta Platforms Inc.'
        WHERE ticker = 'META' AND (sector IS NULL OR sector = 'Other');
      UPDATE holdings SET sector = 'Consumer Cyclical', name = 'Tesla Inc.'
        WHERE ticker = 'TSLA' AND (sector IS NULL OR sector = 'Other');
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
  }
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
