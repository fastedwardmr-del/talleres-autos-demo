-- Additive migration after 0003. No operational or historical rows are removed.
ALTER TABLE user_credentials ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 100000;
ALTER TABLE user_credentials ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_order_assignments ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDIENTE'
 CHECK(status IN ('PENDIENTE','EN PROCESO','TERMINADO'));
ALTER TABLE technician_commissions ADD COLUMN snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(snapshot_json));
CREATE TABLE commission_reversals (
 company_id TEXT NOT NULL, commission_id TEXT NOT NULL,
 reason TEXT NOT NULL, recorded_by_user_id TEXT NOT NULL,
 paid_amount_cents INTEGER NOT NULL CHECK(paid_amount_cents>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(company_id,commission_id),
 FOREIGN KEY(company_id,commission_id) REFERENCES technician_commissions(company_id,id)
);
CREATE TRIGGER commission_payment_balance BEFORE INSERT ON commission_payment_items
 WHEN NOT EXISTS (SELECT 1 FROM technician_commissions c JOIN commission_payments p
 ON p.company_id=c.company_id AND p.id=NEW.payment_id AND p.technician_id=c.technician_id
 WHERE c.company_id=NEW.company_id AND c.id=NEW.commission_id AND c.status='PENDING'
 AND NEW.amount_cents <= c.commission_amount_cents-COALESCE((SELECT SUM(i.amount_cents)
 FROM commission_payment_items i WHERE i.company_id=c.company_id AND i.commission_id=c.id),0))
 BEGIN SELECT RAISE(ABORT,'COMMISSION_BALANCE'); END;

CREATE UNIQUE INDEX commission_once_per_service_technician ON technician_commissions(company_id,work_order_id,assignment_key,technician_id) WHERE status!='REVERSED';
