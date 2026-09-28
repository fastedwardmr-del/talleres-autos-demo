import {requireAdmin} from './auth.js';
import {passwordRecord} from './passwords.js';
import {loadState,commitState,statement} from './repository.js';
import {resolveCommissionRate} from './commissions.js';
import {fail,validId,validateTenant} from './validation.js';

const list=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results||[];
const rate=n=>{if(!Number.isSafeInteger(n)||n<0||n>10000)fail('Porcentaje inválido: usa entre 0 y 100 con hasta dos decimales.');return n;};
const text=(v,label,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(`${label} inválido.`);return v.trim();};
export async function commissionData(db,company,technicianId=null){
 const own=technicianId?' AND technician_id=?':'',args=technicianId?[company,technicianId]:[company];
 const results=await db.batch([
  db.prepare(`SELECT c.*,COALESCE((SELECT SUM(i.amount_cents) FROM commission_payment_items i WHERE i.company_id=c.company_id AND i.commission_id=c.id),0) paid_cents FROM technician_commissions c WHERE company_id=?${own} ORDER BY created_at DESC,id`).bind(...args),
  db.prepare(`SELECT * FROM commission_payments WHERE company_id=?${own} ORDER BY paid_at DESC,id`).bind(...args),
  db.prepare(`SELECT r.* FROM commission_reversals r JOIN technician_commissions c ON c.company_id=r.company_id AND c.id=r.commission_id WHERE c.company_id=?${technicianId?' AND c.technician_id=?':''}`).bind(...args),
  db.prepare(`SELECT i.* FROM commission_payment_items i JOIN commission_payments p ON p.company_id=i.company_id AND p.id=i.payment_id WHERE p.company_id=?${technicianId?' AND p.technician_id=?':''}`).bind(...args)
 ]);
 return {commissions:results[0].results.map(c=>({...c,order_number:JSON.parse(c.snapshot_json).orderNumber||c.work_order_id,invoice_number:JSON.parse(c.snapshot_json).saleNumber||c.sale_id,invoice_date:JSON.parse(c.snapshot_json).invoiceDate||c.created_at,pending_cents:c.status==='PENDING'?c.commission_amount_cents-c.paid_cents:0})),payments:results[1].results,reversals:results[2].results,paymentItems:results[3].results};
}
export async function rateConfig(db,company){
 const results=await db.batch([
  db.prepare('SELECT * FROM commission_settings WHERE company_id=?').bind(company),
  db.prepare('SELECT * FROM service_commission_rates WHERE company_id=?').bind(company),
  db.prepare('SELECT * FROM technician_commission_rates WHERE company_id=?').bind(company)
 ]);
 return {settings:results[0].results[0]||{mode:'GENERAL',default_rate_basis_points:0},serviceRates:results[1].results,technicianRates:results[2].results};
}
export function effectiveRate(config,technician,service){
 return resolveCommissionRate({mode:config.settings.mode,defaultRate:config.settings.default_rate_basis_points,
  serviceRate:config.serviceRates.find(r=>r.service_id===service)?.rate_basis_points,
  technicianRate:config.technicianRates.find(r=>r.technician_id===technician&&!r.service_id)?.rate_basis_points,
  technicianServiceRate:config.technicianRates.find(r=>r.technician_id===technician&&r.service_id===service)?.rate_basis_points});
}
export async function technicianPanel(db,session){
 const company=session.company_id,id=session.technician_id;
 // Explicit column projection: never load the global state for a technician.
 const rows=await list(db,`SELECT a.id,a.work_order_id,a.assignment_key,COALESCE(json_extract(i.payload,'$.status'),a.status) AS status,w.number,w.status AS order_status,
 v.plate_normalized AS plate,json_extract(i.payload,'$.name') AS service_name
 FROM work_order_assignments a JOIN work_orders w ON w.company_id=a.company_id AND w.id=a.work_order_id
 JOIN work_order_items i ON i.company_id=a.company_id AND i.work_order_id=a.work_order_id AND json_extract(i.payload,'$.id')=a.assignment_key
 LEFT JOIN vehicles v ON v.company_id=w.company_id AND v.id=w.vehicle_id
 WHERE a.company_id=? AND a.technician_id=? ORDER BY w.number,a.id`,company,id);
 const data=await commissionData(db,company,id);
 // Snapshots are admin audit records; expose only the technician's earnings fields.
 data.commissions=data.commissions.map(({snapshot_json,company_id,...c})=>c);
 return {name:session.name,assignments:rows,...data};
}
export async function adminPanel(db,company){
 const {state,revision}=await loadState(db,company),config=await rateConfig(db,company);
 const assignments=await list(db,'SELECT * FROM work_order_assignments WHERE company_id=?',company);
 return {revision,...config,...await commissionData(db,company),assignments:assignments.map(a=>({...a,effective_rate_basis_points:effectiveRate(config,a.technician_id,a.service_id||'')})),
  accounts:await list(db,'SELECT u.user_id,u.name,u.role,c.enabled,c.technician_id FROM users u JOIN user_credentials c ON c.company_id=u.company_id AND c.user_id=u.user_id WHERE u.company_id=?',company),
  technicians:state.technicians,services:state.services,orders:state.orders.map(o=>({id:o.id,number:o.number,status:o.status,items:o.items.filter(i=>i.kind==='service')}))};
}
export async function moduleCommand(db,session,path,body){
 requireAdmin(session);if(!body||typeof body!=='object'||Array.isArray(body))fail('Solicitud inválida.');const company=session.company_id;validateTenant(body,company);
 if(!validId(body.requestId)||!Number.isSafeInteger(body.revision)||body.revision<0)fail('Operación o revisión inválida.');
 const receipt=await db.prepare('SELECT result_json FROM request_receipts WHERE company_id=? AND id=?').bind(company,body.requestId).first();
 if(receipt)return JSON.parse(receipt.result_json);
 const loaded=await loadState(db,company),state=loaded.state;
 if(loaded.revision!==body.revision)fail('Los datos cambiaron. Actualiza antes de guardar.','CONFLICT',409);
 const stmts=[];let result={saved:true};
 if(path==='/api/team/accounts'){
  const userId=text(body.userId,'Usuario',100).toLowerCase();if(!validId(userId))fail('Usa letras, números, guion o guion bajo para el usuario.');
  if(!['ADMIN','TECNICO'].includes(body.role)||typeof body.enabled!=='boolean')fail('Rol o estado inválido.');
  const name=text(body.name,'Nombre',100),technician=body.role==='TECNICO'?state.technicians.find(t=>t.id===body.technicianId):null;
  if(body.role==='TECNICO'&&!technician)fail('Selecciona un técnico válido.');
  const old=await db.prepare('SELECT * FROM user_credentials WHERE company_id=? AND user_id=?').bind(company,userId).first();
  if(old&&old.technician_id!==(technician?.id||null))fail('No se puede reasignar una cuenta existente a otra identidad. Crea otra cuenta.');
  if(userId===session.user_id&&(!body.enabled||body.role!=='ADMIN'))fail('No puedes desactivar tu propia cuenta administradora.');
  const password=body.password?await passwordRecord(body.password):null;if(!old&&!password)fail('La cuenta nueva necesita contraseña.');
  stmts.push(statement('INSERT INTO users(company_id,user_id,name,role) VALUES(?,?,?,?) ON CONFLICT(company_id,user_id) DO UPDATE SET name=excluded.name,role=excluded.role',company,userId,name,body.role));
  if(!old)stmts.push(statement('INSERT INTO user_credentials(company_id,user_id,password_hash,password_salt,password_iterations,enabled,technician_id) VALUES(?,?,?,?,?,?,?)',company,userId,password.password_hash,password.password_salt,password.password_iterations,Number(body.enabled),technician?.id||null));
  else {
   stmts.push(statement('UPDATE user_credentials SET enabled=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE company_id=? AND user_id=?',Number(body.enabled),company,userId));
   if(password)stmts.push(statement('UPDATE user_credentials SET password_hash=?,password_salt=?,password_iterations=? WHERE company_id=? AND user_id=?',password.password_hash,password.password_salt,password.password_iterations,company,userId));
  }
 }else if(path==='/api/team/rates'){
  if(!['GENERAL','SERVICE'].includes(body.mode))fail('Modo de comisión inválido.');
  const general=rate(body.defaultRate);
  if(!Array.isArray(body.serviceRates)||!Array.isArray(body.technicianRates)||body.serviceRates.length>1000||body.technicianRates.length>2000)fail('Configuración demasiado extensa.');
  const used=new Set();
  stmts.push(statement('INSERT INTO commission_settings(company_id,mode,default_rate_basis_points) VALUES(?,?,?) ON CONFLICT(company_id) DO UPDATE SET mode=excluded.mode,default_rate_basis_points=excluded.default_rate_basis_points,updated_at=CURRENT_TIMESTAMP',company,body.mode,general),statement('DELETE FROM service_commission_rates WHERE company_id=?',company),statement('DELETE FROM technician_commission_rates WHERE company_id=?',company));
  for(const r of body.serviceRates){if(!state.services.some(s=>s.id===r.service_id)||used.has('s:'+r.service_id))fail('Servicio inexistente o repetido.');used.add('s:'+r.service_id);stmts.push(statement('INSERT INTO service_commission_rates VALUES(?,?,?)',company,r.service_id,rate(r.rate_basis_points)));}
  for(const r of body.technicianRates){const service=r.service_id||'',key=r.technician_id+':'+service;if(!state.technicians.some(t=>t.id===r.technician_id)||(service&&!state.services.some(s=>s.id===service))||used.has(key))fail('Excepción inexistente o repetida.');used.add(key);stmts.push(statement('INSERT INTO technician_commission_rates VALUES(?,?,?,?)',company,r.technician_id,service,rate(r.rate_basis_points)));}
 }else if(path==='/api/team/assignments'){
  const order=state.orders.find(o=>o.id===body.orderId);if(!order||['CANCELADO','ENTREGADO'].includes(order.status))fail('Orden no disponible para asignar.');
  if(state.sales.some(s=>s.orderId===order.id)||await db.prepare("SELECT 1 FROM technician_commissions WHERE company_id=? AND work_order_id=? AND status!='REVERSED' LIMIT 1").bind(company,order.id).first())fail('La orden ya fue facturada.');
  if(!Array.isArray(body.assignments)||body.assignments.length>500)fail('Asignaciones inválidas.');
  const old=await list(db,'SELECT * FROM work_order_assignments WHERE company_id=? AND work_order_id=?',company,order.id),config=await rateConfig(db,company),used=new Set(),lineServices=new Map();
  stmts.push(statement('DELETE FROM work_order_assignments WHERE company_id=? AND work_order_id=?',company,order.id));
  for(const a of body.assignments){
   const item=order.items.find(i=>i.id===a.assignmentKey&&i.kind==='service'),tech=state.technicians.find(t=>t.id===a.technicianId&&t.status!=='INACTIVO'),key=a.assignmentKey+':'+a.technicianId;
   if(!item||!validId(item.id)||order.items.filter(i=>i.id===item.id).length!==1||!tech||used.has(key))fail('Servicio/técnico inexistente, inactivo o duplicado.');used.add(key);
   const catalogService=item.serviceId||item.catalogId||item.catalog||'',service=catalogService||a.serviceId||'',prior=old.find(r=>r.assignment_key===item.id&&r.technician_id===tech.id);
   if((catalogService&&a.serviceId&&a.serviceId!==catalogService)||(lineServices.has(item.id)&&lineServices.get(item.id)!==service))fail('La referencia del servicio debe ser coherente para todos los técnicos.');lineServices.set(item.id,service);if(service&&!state.services.some(s=>s.id===service))fail('El servicio ya no existe en el catálogo.');
   stmts.push(statement('INSERT INTO work_order_assignments(company_id,id,work_order_id,assignment_key,technician_id,service_id,rate_basis_points,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',company,prior?.id||crypto.randomUUID(),order.id,item.id,tech.id,service||null,effectiveRate(config,tech.id,service),prior?.status||item.status||'PENDIENTE',prior?.created_at||new Date().toISOString()));
  }
 }else if(path==='/api/team/payments'){
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>500||new Set(body.items.map(i=>i.commissionId)).size!==body.items.length)fail('Selecciona comisiones sin duplicados.');
  if(!['Efectivo','Transferencia','Tarjeta','Otros'].includes(body.method))fail('Método de pago inválido.');
  if(typeof body.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!Number.isFinite(Date.parse(body.date))||new Date(body.date).toISOString().slice(0,10)!==body.date)fail('Fecha de pago inválida.');
  const reference=text(body.reference,'Referencia',200),data=await commissionData(db,company),id=crypto.randomUUID();let amount=0,tech=null;
  for(const i of body.items){const c=data.commissions.find(c=>c.id===i.commissionId);if(!c||c.status!=='PENDING'||!Number.isSafeInteger(i.amountCents)||i.amountCents<=0||i.amountCents>c.pending_cents||(tech&&tech.technician_id!==c.technician_id))fail('El pago supera el saldo o mezcla técnicos.');tech=c;amount+=i.amountCents;}
  if(!Number.isSafeInteger(amount)||amount!==body.amountCents)fail('El importe debe coincidir con las comisiones seleccionadas.');
  stmts.push(statement('INSERT INTO commission_payments(company_id,id,technician_id,technician_name,amount_cents,payment_method,reference,paid_at,recorded_by_user_id) VALUES(?,?,?,?,?,?,?,?,?)',company,id,tech.technician_id,tech.technician_name,amount,body.method,reference,body.date,session.user_id));
  for(const i of body.items){stmts.push(statement('INSERT INTO commission_payment_items VALUES(?,?,?,?)',company,id,i.commissionId,i.amountCents),statement("UPDATE technician_commissions SET status='PAID' WHERE company_id=? AND id=? AND commission_amount_cents=(SELECT SUM(amount_cents) FROM commission_payment_items WHERE company_id=? AND commission_id=?)",company,i.commissionId,company,i.commissionId));}
  result={paymentId:id,amountCents:amount};
 }else fail('Operación no disponible.','NOT_FOUND',404);
 await commitState(db,company,state,state,body.revision,body.requestId,result,stmts);
 return result;
}

// Used in the SAME batch as operational deletions. Historical payments are retained.
export function reversalStatements(company,saleIds,actor,reason){
 return saleIds.flatMap(id=>[
  statement(`INSERT INTO commission_reversals(company_id,commission_id,reason,recorded_by_user_id,paid_amount_cents)
   SELECT company_id,id,?,?,COALESCE((SELECT SUM(i.amount_cents) FROM commission_payment_items i WHERE i.company_id=c.company_id AND i.commission_id=c.id),0)
   FROM technician_commissions c WHERE company_id=? AND sale_id=? AND status!='REVERSED'`,reason,actor,company,id),
  statement("UPDATE technician_commissions SET status='REVERSED' WHERE company_id=? AND sale_id=?",company,id)
 ]);
}
export async function validateAssignmentEdits(db,company,before,after){
 const assignments=await list(db,'SELECT * FROM work_order_assignments WHERE company_id=?',company);
 for(const a of assignments){const order=after.orders.find(o=>o.id===a.work_order_id);if(!order)continue;
  const line=order.items.find(i=>i.id===a.assignment_key),old=before.orders.find(o=>o.id===a.work_order_id)?.items.find(i=>i.id===a.assignment_key);
  if(!line||line.kind!=='service'||order.items.filter(i=>i.id===a.assignment_key).length!==1||line.name!==old?.name||(line.serviceId||line.catalogId||line.catalog||'')!==(old?.serviceId||old?.catalogId||old?.catalog||''))fail('Retira primero las asignaciones del servicio antes de quitarlo o cambiar su identidad.');
 }
}
