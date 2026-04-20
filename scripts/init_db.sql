CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    ocr_space_api_key VARCHAR(255),
    odoo_url VARCHAR(255),
    odoo_db VARCHAR(255),
    odoo_login VARCHAR(255),
    odoo_api_key VARCHAR(255),
    odoo_expense_model VARCHAR(255) NOT NULL DEFAULT 'hr.expense',
    odoo_employee_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_name VARCHAR(255),
    invoice_number VARCHAR(120),
    invoice_date DATE,
    currency VARCHAR(12) NOT NULL DEFAULT 'EUR',
    total_amount NUMERIC(12, 2),
    tax_amount NUMERIC(12, 2),
    raw_ocr_text TEXT,
    notes TEXT,
    odoo_synced BOOLEAN NOT NULL DEFAULT FALSE,
    odoo_id INTEGER,
    odoo_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor_name ON expenses(vendor_name);
CREATE INDEX IF NOT EXISTS idx_expenses_invoice_date ON expenses(invoice_date);
