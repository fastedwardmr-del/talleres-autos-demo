import {calculateInvoiceCommissions} from './commissions.js';
import {statement} from './repository.js';

// Called ONLY for an invoice accepted by DemoStore.checkout. Never trust
// commission rates or assignment IDs supplied in the HTTP sale payload.
export async function invoiceCommissionStatements(db,company,sale,state){
 if(sale.origin!=='TALLER'||!sale.quoteId||!sale.orderId)return [];
 const quote=state.quotes.find(q=>q.id===sale.quoteId);
 if(!quote||quote.orderId!==sale.orderId)throw new Error('La factura no corresponde a la orden cotizada.');
 const [assignmentsResult,settings,serviceResult,techResult]=await Promise.all([
  db.prepare('SELECT * FROM work_order_assignments WHERE company_id=? AND work_order_id=?').bind(company,sale.orderId).all(),
  db.prepare('SELECT * FROM commission_settings WHERE company_id=?').bind(company).first(),
  db.prepare('SELECT service_id,rate_basis_points FROM service_commission_rates WHERE company_id=?').bind(company).all(),
  db.prepare('SELECT technician_id,service_id,rate_basis_points FROM technician_commission_rates WHERE company_id=?').bind(company).all()
 ]);
 const assignments=assignmentsResult.results||[];
 if(!assignments.length)return [];
 const lines=new Map(sale.items.filter(i=>i.kind==='service').map(i=>[i.id,i]));
 if(lines.size!==sale.items.filter(i=>i.kind==='service').length)throw new Error('La factura contiene servicios sin identificación única.');
 // Refuse stale assignments: a removed/changed OT service must not be paid.
 const order=state.orders.find(o=>o.id===sale.orderId);
 if(!order)throw new Error('La orden de trabajo ya no existe.');
 for(const a of assignments){
  const line=lines.get(a.assignment_key),orderLine=order.items.find(i=>i.id===a.assignment_key);
  if(!line||!orderLine||orderLine.kind!=='service'||line.name!==orderLine.name)
   throw new Error('Una asignación de técnico ya no corresponde al servicio facturado. Revísala antes de facturar.');
 }
 const rows=calculateInvoiceCommissions({sale,assignments,technicians:state.technicians,
  settings:settings||{mode:'GENERAL',default_rate_basis_points:0},
  serviceRates:serviceResult.results||[],technicianRates:techResult.results||[]});
 return rows.map(row=>statement(`INSERT INTO technician_commissions
 (company_id,id,sale_id,work_order_id,assignment_id,assignment_key,technician_id,technician_name,service_id,service_name,base_amount_cents,rate_basis_points,commission_amount_cents,status)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
 company,crypto.randomUUID(),row.sale_id,row.work_order_id,row.assignment_id,row.assignment_key,row.technician_id,row.technician_name,row.service_id,row.service_name,row.base_amount_cents,row.rate_basis_points,row.commission_amount_cents,row.status));
}
