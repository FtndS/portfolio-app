import pool from './index.js'
import { rebuildHoldingsFromTransactions } from '../lib/holdingSync.js'

const migrations = [
  {
    name: '000_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        password_reset_token VARCHAR(64),
        password_reset_expires TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
        ON users (LOWER(email));

      CREATE UNIQUE INDEX IF NOT EXISTS users_password_reset_token_idx
        ON users (password_reset_token)
        WHERE password_reset_token IS NOT NULL;

      CREATE TABLE IF NOT EXISTS portfolios (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        currency VARCHAR(3) DEFAULT 'USD',
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS holdings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        ticker VARCHAR(32) NOT NULL,
        name VARCHAR(255),
        shares NUMERIC(18, 4) NOT NULL DEFAULT 0,
        avg_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
        sector VARCHAR(64) DEFAULT 'Other',
        currency VARCHAR(3) DEFAULT 'USD',
        market VARCHAR(20) DEFAULT 'US',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        holding_id INTEGER REFERENCES holdings(id) ON DELETE SET NULL,
        ticker VARCHAR(32) NOT NULL,
        type VARCHAR(4) NOT NULL CHECK (type IN ('BUY', 'SELL')),
        shares NUMERIC(18, 4) NOT NULL,
        price NUMERIC(18, 4) NOT NULL,
        total NUMERIC(18, 2),
        note TEXT,
        date DATE NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS journal (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        title VARCHAR(255),
        content TEXT,
        tickers VARCHAR(255),
        tag VARCHAR(64),
        date DATE,
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

      CREATE TABLE IF NOT EXISTS dividends (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        ticker VARCHAR(32) NOT NULL,
        amount NUMERIC(18, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'THB',
        shares_held NUMERIC(18, 4),
        pay_date DATE NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS dividends_portfolio_pay_date_idx
        ON dividends (portfolio_id, pay_date DESC);
    `,
  },
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
  {
    name: '012_transactions_currency',
    sql: `
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';

      UPDATE transactions SET currency = 'THB'
      WHERE (ticker ILIKE '%-BK' OR ticker ILIKE '%.BK')
        AND COALESCE(currency, 'USD') = 'USD';

      UPDATE transactions t SET currency = h.currency
      FROM holdings h
      WHERE h.user_id = t.user_id
        AND h.portfolio_id = t.portfolio_id
        AND h.ticker = t.ticker
        AND h.currency IS NOT NULL
        AND COALESCE(t.currency, 'USD') = 'USD'
        AND h.currency != 'USD';

      UPDATE transactions SET currency = 'USD' WHERE currency IS NULL;
    `,
  },
  {
    name: '013_dividends',
    sql: `
      CREATE TABLE IF NOT EXISTS dividends (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        ticker VARCHAR(32) NOT NULL,
        amount NUMERIC(18, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'THB',
        shares_held NUMERIC(18, 4),
        pay_date DATE NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS dividends_portfolio_pay_date_idx
        ON dividends (portfolio_id, pay_date DESC);
    `,
  },
  {
    name: '014_email_verified_strict',
    sql: `
      UPDATE users SET email_verified = false WHERE email_verified IS NULL;
      ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;
      ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;
    `,
  },
  {
    name: '015_transactions_fee',
    sql: `
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee NUMERIC(18, 2) NOT NULL DEFAULT 0;
    `,
    async after() {
      await rebuildHoldingsFromTransactions(pool)
    },
  },
  {
    name: '016_investment_thesis',
    sql: `
      CREATE TABLE IF NOT EXISTS investment_thesis (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        ticker VARCHAR(32) NOT NULL,
        thesis TEXT NOT NULL DEFAULT '',
        invalidation TEXT NOT NULL DEFAULT '',
        horizon VARCHAR(64) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, portfolio_id, ticker)
      );

      CREATE INDEX IF NOT EXISTS investment_thesis_portfolio_idx
        ON investment_thesis (portfolio_id, ticker);
    `,
  },
  {
    name: '017_ai_usage',
    sql: `
      CREATE TABLE IF NOT EXISTS ai_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        feature VARCHAR(32) NOT NULL,
        used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS ai_usage_user_feature_used_idx
        ON ai_usage (user_id, feature, used_at DESC);
    `,
  },
  {
    name: '018_user_role_support_tickets',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(32) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        admin_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
        ON support_tickets (status, created_at DESC);

      CREATE INDEX IF NOT EXISTS support_tickets_user_created_idx
        ON support_tickets (user_id, created_at DESC);
    `,
    async after() {
      const { getBootstrapAdminEmail } = await import('../lib/admin.js')
      const adminEmail = getBootstrapAdminEmail()
      await pool.query(
        `UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER($1)`,
        [adminEmail]
      )
    },
  },
  {
    name: '019_user_plan',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
    `,
  },
  {
    name: '020_shares_precision_10',
    sql: `
      ALTER TABLE holdings ALTER COLUMN shares TYPE NUMERIC(28, 10);
      ALTER TABLE transactions ALTER COLUMN shares TYPE NUMERIC(28, 10);
      ALTER TABLE dividends ALTER COLUMN shares_held TYPE NUMERIC(28, 10);
    `,
  },
  {
    name: '021_token_version',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    name: '022_plan_admin_fields',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_note TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ;
    `,
  },
  {
    name: '023_support_receipt',
    sql: `
      ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS receipt_mime VARCHAR(64);
      ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS receipt_data BYTEA;
    `,
  },
  {
    name: '024_rebuild_holdings_avg_cost',
    sql: `SELECT 1`,
    async after() {
      await rebuildHoldingsFromTransactions(pool)
    },
  },
  {
    name: '025_stripe_and_ticket_attachments',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
      CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_idx
        ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        event_id VARCHAR(255) PRIMARY KEY,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS support_ticket_attachments (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        mime VARCHAR(64) NOT NULL,
        data BYTEA NOT NULL,
        sort_order SMALLINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS support_ticket_attachments_ticket_idx
        ON support_ticket_attachments (ticket_id, sort_order);
    `,
  },
  {
    name: '026_omise_promptpay',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS omise_customer_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS omise_schedule_id VARCHAR(255);
      CREATE UNIQUE INDEX IF NOT EXISTS users_omise_customer_id_idx
        ON users (omise_customer_id) WHERE omise_customer_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS omise_webhook_events (
        event_id VARCHAR(255) PRIMARY KEY,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS omise_promptpay_charges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        charge_id VARCHAR(255) NOT NULL UNIQUE,
        source_id VARCHAR(255),
        amount_satang INTEGER NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        qr_image_url TEXT,
        source_expires_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        granted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS omise_promptpay_charges_user_created_idx
        ON omise_promptpay_charges (user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS omise_card_charges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        charge_id VARCHAR(255) NOT NULL UNIQUE,
        amount_satang INTEGER NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS omise_card_charges_user_created_idx
        ON omise_card_charges (user_id, created_at DESC);
    `,
  },
  {
    name: '027_omise_card_recurring_columns',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS omise_customer_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS omise_schedule_id VARCHAR(255);
      CREATE UNIQUE INDEX IF NOT EXISTS users_omise_customer_id_idx
        ON users (omise_customer_id) WHERE omise_customer_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS omise_card_charges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        charge_id VARCHAR(255) NOT NULL UNIQUE,
        amount_satang INTEGER NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS omise_card_charges_user_created_idx
        ON omise_card_charges (user_id, created_at DESC);
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
