-- Ejecutar una vez si la tabla integration_settings ya existia sin esta columna:
--   psql -U ... -d expenseapp -f scripts/add_odoo_employee_id.sql

ALTER TABLE integration_settings
ADD COLUMN IF NOT EXISTS odoo_employee_id INTEGER;
