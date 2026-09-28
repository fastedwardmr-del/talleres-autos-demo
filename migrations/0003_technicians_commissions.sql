-- TallerPro 0003 - usuarios y comisiones. SOLO entorno de pruebas hasta integrar Worker.
-- No modifica datos actuales. No ejecutar si se aplico una version previa de 0003.
CREATE TABLE user_credentials (
 company_id TEXT NOT NULL, user_id TEXT NOT NULL,
 password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
 password_algorithm TEXT NOT NULL DEFAULT 'PBKDF2-SHA256',
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 technician_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(company_id,user_id),
 FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,user_id),
 FOREIGN KEY(company_id,technician_id) REFERENCES technicians(company_id,id),
 UNIQUE(company_id,technician_id)
);
CREATE TABLE commission_settings (
 company_id TEXT PRIMARY KEY,
 mode TEXT NOT NULL DEFAULT 'GENERAL' CHECK(mode IN ('GENERAL','SERVICE')),
 default_rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK(default_rate_basis_points BETWEEN 0 AND 10000),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(company_id) REFERENCES companies(company_id)
);
CREATE TABLE service_commission_rates (
 company_id TEXT NOT NULL, service_id TEXT NOT NULL,
 rate_basis_points INTEGER NOT NULL CHECK(rate_basis_points BETWEEN 0 AND 10000),
 PRIMARY KEY(company_id,service_id),
 FOREIGN KEY(company_id,service_id) REFERENCES services(company_id,id)
);
CREATE TABLE technician_commission_rates (
 company_id TEXT NOT NULL, technician_id TEXT NOT NULL,
 service_id TEXT NOT NULL DEFAULT '',
 rate_basis_points INTEGER NOT NULL CHECK(rate_basis_points BETWEEN 0 AND 10000),
 PRIMARY KEY(company_id,technician_id,service_id),
 FOREIGN KEY(company_id,technician_id) REFERENCES technicians(company_id,id)
);
-- assignment_key identifica una linea de servicio estable, NO un work_order_items.id
-- (repository.js recrea work_order_items al editar una OT).
CREATE TABLE work_order_assignments (
 company_id TEXT NOT NULL, id TEXT NOT NULL,
 work_order_id TEXT NOT NULL, assignment_key TEXT NOT NULL,
 technician_id TEXT NOT NULL, service_id TEXT,
 rate_basis_points INTEGER NOT NULL CHECK(rate_basis_points BETWEEN 0 AND 10000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(company_id,id),
 UNIQUE(company_id,work_order_id,assignment_key,technician_id),
 FOREIGN KEY(company_id,work_order_id) REFERENCES work_orders(company_id,id),
 FOREIGN KEY(company_id,technician_id) REFERENCES technicians(company_id,id)
);
CREATE INDEX work_order_assignments_technician
 ON work_order_assignments(company_id,technician_id,work_order_id);
-- Historico: instantaneas sin FK a orden, venta, asignacion o tecnico,
-- porque SuperAdmin puede eliminar registros operativos.
CREATE TABLE technician_commissions (
 company_id TEXT NOT NULL, id TEXT NOT NULL,
 sale_id TEXT NOT NULL, work_order_id TEXT NOT NULL,
 assignment_id TEXT NOT NULL, assignment_key TEXT NOT NULL,
 technician_id TEXT NOT NULL, technician_name TEXT NOT NULL,
 service_id TEXT, service_name TEXT NOT NULL,
 base_amount_cents INTEGER NOT NULL CHECK(base_amount_cents>=0),
 rate_basis_points INTEGER NOT NULL CHECK(rate_basis_points BETWEEN 0 AND 10000),
 commission_amount_cents INTEGER NOT NULL CHECK(commission_amount_cents>=0),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PAID','REVERSED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(company_id,id),
 UNIQUE(company_id,sale_id,assignment_id),
 FOREIGN KEY(company_id) REFERENCES companies(company_id)
);
CREATE INDEX technician_commissions_technician
 ON technician_commissions(company_id,technician_id,status,created_at);
CREATE TABLE commission_payments (
 company_id TEXT NOT NULL, id TEXT NOT NULL,
 technician_id TEXT NOT NULL, technician_name TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 payment_method TEXT NOT NULL, reference TEXT,
 paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 recorded_by_user_id TEXT NOT NULL,
 PRIMARY KEY(company_id,id),
 FOREIGN KEY(company_id) REFERENCES companies(company_id)
);
CREATE TABLE commission_payment_items (
 company_id TEXT NOT NULL, payment_id TEXT NOT NULL,
 commission_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 PRIMARY KEY(company_id,payment_id,commission_id),
 FOREIGN KEY(company_id,payment_id) REFERENCES commission_payments(company_id,id),
 FOREIGN KEY(company_id,commission_id) REFERENCES technician_commissions(company_id,id)
);
CREATE INDEX commission_payment_items_commission
 ON commission_payment_items(company_id,commission_id);
