import test from 'node:test';
import assert from 'node:assert/strict';
import {SQLiteD1,MemoryR2} from './helpers/sqlite-d1.mjs';
import {seedSql} from '../scripts/seed.mjs';
import {handleCloud} from '../backend/cloud/worker.js';
import {passwordRecord} from '../backend/cloud/passwords.js';
import {loadState,writeEntity,prepared} from '../backend/cloud/repository.js';
import {calculateInvoiceCommissions} from '../backend/cloud/commissions.js';
const password='Test-password-12345';
async function setup(){
 const env={DB:new SQLiteD1(),FILES:new MemoryR2(),SESSION_SECRET:'test-only-session-secret',DEMO_ACCESS_CODE:'test-demo'};env.DB.sqlite.exec(seedSql());
 const credential=await passwordRecord(password);
 env.DB.sqlite.prepare("INSERT INTO users VALUES('demo','owner','Dueño','ADMIN')").run();
 env.DB.sqlite.prepare("INSERT INTO user_credentials(company_id,user_id,password_hash,password_salt,password_iterations) VALUES('demo','owner',?,?,?)").run(credential.password_hash,credential.password_salt,credential.password_iterations);
 async function raw(path,body,token=''){
  return handleCloud(new Request('https://api.test'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 }
 async function call(path,body,token=admin){const r=await raw(path,body,token),payload=await r.json();if(!r.ok)throw Object.assign(new Error(payload.error.message),{status:r.status,code:payload.error.code});return payload.data;}
 const admin=(await (await raw('/api/session',{userId:'owner',password})).json()).data.token;
 const revision=async()=>(await loadState(env.DB,'demo')).revision;
 async function cmd(path,body){return call('/api/team/'+path,{...body,revision:await revision(),requestId:'test-'+crypto.randomUUID()});}
 async function account(userId,technicianId){await cmd('accounts',{userId,name:userId,role:'TECNICO',enabled:true,password,technicianId});return (await call('/api/session',{userId,password},'')).token;}
 async function fixture(){
  const {state}=await loadState(env.DB,'demo'),order={...state.orders[0],id:'order-team',number:'OT-TEAM',status:'EN PROCESO',items:[{id:'line-team',kind:'service',serviceId:state.services[0].id,name:'Servicio comisión',price:100000,quantity:2,status:'PENDIENTE'},{id:'part-team',kind:'product',name:state.products[0].name,productId:state.products[0].id,price:50000,quantity:1}]};
  const quote={...state.quotes[0],id:'quote-team',number:'COT-TEAM',orderId:order.id,clientId:order.clientId,vehicleId:order.vehicleId,status:'APROBADA',items:structuredClone(order.items),discount:10,tax:19};
  await env.DB.batch(prepared(env.DB,[...writeEntity('demo','orders',order),...writeEntity('demo','quotes',quote)]));
  return {order,quote,tech:state.technicians[0],other:state.technicians[1],service:state.services[0]};
 }
 async function invoice(quote,extra={}){return call('/api/sales',{revision:await revision(),requestId:'invoice-'+crypto.randomUUID(),sale:{quoteId:quote.id,orderId:quote.orderId,origin:'TALLER',clientId:quote.clientId,vehicleId:quote.vehicleId,items:quote.items,discount:quote.discount,tax:quote.tax,date:'2026-09-28',method:'Efectivo',...extra}});}
 return {env,raw,call,cmd,admin,revision,account,fixture,invoice};
}
test('Cuentas: contraseña derivada, acceso individual, errores y revocación inmediata',async()=>{
 const x=await setup(),f=await x.fixture(),token=await x.account('ana',f.tech.id);
 const row=x.env.DB.sqlite.prepare("SELECT * FROM user_credentials WHERE user_id='ana'").get();assert.notEqual(row.password_hash,password);assert.equal(row.password_iterations,100000);assert.ok(row.password_salt.length>=32);
 assert.equal((await x.raw('/api/session',{userId:'ana',password:'bad'})).status,401);
 assert.equal((await x.raw('/api/session',{code:'test-demo'})).status,401);
 assert.equal((await x.call('/api/me',undefined,token)).role,'TECNICO');
 await x.cmd('accounts',{userId:'ana',name:'Ana',role:'TECNICO',enabled:false,technicianId:f.tech.id});
 assert.equal((await x.raw('/api/technician',undefined,token)).status,401);
 await assert.rejects(x.cmd('accounts',{userId:'owner',name:'Owner',role:'ADMIN',enabled:false}),e=>e.status===400);
});
test('Worker: técnico bloqueado en todas las rutas privilegiadas por solicitudes directas',async()=>{
 const x=await setup(),f=await x.fixture(),token=await x.account('ana',f.tech.id);
 for(const path of ['/api/state','/api/sales','/api/technicians','/api/work-orders/'+f.order.id,'/api/customers','/api/cash','/api/team','/api/integrations','/api/companies'])assert.equal((await x.raw(path,undefined,token)).status,403,path);
 for(const path of ['/api/transactions','/api/sales','/api/admin/clean','/api/files','/api/team/accounts','/api/team/assignments','/api/team/payments','/api/team/rates'])assert.equal((await x.raw(path,{},token)).status,403,path);
 assert.equal((await x.raw('/api/technician?company_id=another',undefined,token)).status,403);
});
test('Asignaciones: varios técnicos, porcentaje efectivo y aislamiento de órdenes/datos privados',async()=>{
 const x=await setup(),f=await x.fixture(),ana=await x.account('ana',f.tech.id),bob=await x.account('bob',f.other.id);
 await x.cmd('rates',{mode:'SERVICE',defaultRate:1000,serviceRates:[{service_id:f.service.id,rate_basis_points:1500}],technicianRates:[{technician_id:f.tech.id,service_id:'',rate_basis_points:2000},{technician_id:f.tech.id,service_id:f.service.id,rate_basis_points:2250}]});
 await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});
 const a=await x.call('/api/technician',undefined,ana),b=await x.call('/api/technician',undefined,bob);
 assert.equal(a.assignments.length,1);assert.equal(b.assignments.length,0);assert.equal(a.assignments[0].service_name,'Servicio comisión');
 assert.ok(!JSON.stringify(a).includes('clientId'));assert.ok(!JSON.stringify(a).includes('price'));assert.equal((await x.call('/api/team')).assignments[0].effective_rate_basis_points,2250);
 const before=(await x.call('/api/team')).assignments[0].id;
 await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id},{assignmentKey:'line-team',technicianId:f.other.id}]});
 const rows=(await x.call('/api/team')).assignments;assert.equal(rows.find(a=>a.technician_id===f.tech.id).id,before);assert.equal(rows.length,2);
 await assert.rejects(x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id},{assignmentKey:'line-team',technicianId:f.tech.id}]}),e=>e.status===400);
 assert.equal((await x.call('/api/team')).assignments.length,2);
 await assert.rejects(x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'part-team',technicianId:f.tech.id}]}));
});
test('Configuración: validación, ceros, herencia y cambios futuros sin reescribir historia',async()=>{
 const x=await setup(),f=await x.fixture();
 for(const n of [-1,10001,12.2,'20'])await assert.rejects(x.cmd('rates',{mode:'GENERAL',defaultRate:n,serviceRates:[],technicianRates:[]}));
 await x.cmd('rates',{mode:'GENERAL',defaultRate:2500,serviceRates:[],technicianRates:[]});
 await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});
 await x.cmd('rates',{mode:'GENERAL',defaultRate:3000,serviceRates:[],technicianRates:[]});
 await x.invoice(f.quote);const c=(await x.call('/api/team')).commissions[0];
 assert.equal(c.rate_basis_points,3000);assert.equal(c.base_amount_cents,18000000);assert.equal(c.commission_amount_cents,5400000);
 await x.cmd('rates',{mode:'GENERAL',defaultRate:0,serviceRates:[],technicianRates:[]});
 assert.deepEqual((await x.call('/api/team')).commissions[0],c);assert.equal(JSON.parse(c.snapshot_json).quoteId,f.quote.id);
});
test('Facturación: origen y OT se derivan en servidor, no se evade comisión con POS',async()=>{
 const x=await setup(),f=await x.fixture();await x.cmd('rates',{mode:'GENERAL',defaultRate:2500,serviceRates:[],technicianRates:[]});await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});
 const sale=await x.invoice(f.quote,{origin:'POS',orderId:''});assert.equal(sale.result.origin,'TALLER');assert.equal((await x.call('/api/team')).commissions.length,1);
 await assert.rejects(x.invoice(f.quote));assert.equal((await x.call('/api/team')).commissions.length,1);
 await assert.rejects(x.cmd('assignments',{orderId:f.order.id,assignments:[]}));
});
test('Facturación atómica: error SQL de comisión revierte venta, stock, cotización y recibo',async()=>{
 const x=await setup(),f=await x.fixture();await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});
 const before=await loadState(x.env.DB,'demo');
 x.env.DB.sqlite.exec("CREATE TRIGGER test_fail_commission BEFORE INSERT ON technician_commissions BEGIN SELECT RAISE(ABORT,'test forced commission failure'); END;");
 await assert.rejects(x.invoice(f.quote),e=>e.status===500);assert.deepEqual(await loadState(x.env.DB,'demo'),before);
 assert.equal(x.env.DB.sqlite.prepare('SELECT count(*) n FROM technician_commissions').get().n,0);
});
test('Edición OT: impide borrar servicios asignados; conserva estado visible y referencia estable',async()=>{
 const x=await setup(),f=await x.fixture(),token=await x.account('ana',f.tech.id);await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});
 const change=async order=>x.call('/api/transactions',{revision:await x.revision(),requestId:'edit-'+crypto.randomUUID(),changes:[{type:'orders',value:order}]});
 await assert.rejects(change({...f.order,items:[f.order.items[1]]}),e=>e.status===400);
 await change({...f.order,items:f.order.items.map(i=>({...i,status:'TERMINADO'}))});assert.equal((await x.call('/api/technician',undefined,token)).assignments[0].status,'TERMINADO');
 await x.cmd('assignments',{orderId:f.order.id,assignments:[]});await change({...f.order,items:[f.order.items[1]]});assert.equal((await x.call('/api/team')).assignments.length,0);
});
test('Pagos: abonos, liquidación, idempotencia, duplicados, importe y aislamiento del historial',async()=>{
 const x=await setup(),f=await x.fixture(),token=await x.account('ana',f.tech.id),other=await x.account('bob',f.other.id);
 await x.cmd('rates',{mode:'GENERAL',defaultRate:2500,serviceRates:[],technicianRates:[]});await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});await x.invoice(f.quote);
 const c=(await x.call('/api/team')).commissions[0],body={date:'2026-09-28',method:'Transferencia',reference:'TEST-REF',items:[{commissionId:c.id,amountCents:1000000}],amountCents:1000000,revision:await x.revision(),requestId:'payment-one'};
 const a=await x.call('/api/team/payments',body);assert.deepEqual(await x.call('/api/team/payments',body),a);
 const first=(await x.call('/api/technician',undefined,token));assert.equal(first.payments.length,1);assert.equal(first.commissions[0].pending_cents,3500000);assert.equal(first.commissions[0].snapshot_json,undefined);
 assert.equal((await x.call('/api/technician',undefined,other)).payments.length,0);
 await assert.rejects(x.cmd('payments',{...body,items:[{commissionId:c.id,amountCents:4500000}],amountCents:4500000}),e=>e.status===400);
 await assert.rejects(x.cmd('payments',{...body,items:[body.items[0],body.items[0]],amountCents:2000000}),e=>e.status===400);
 await assert.rejects(x.cmd('payments',{...body,amountCents:1}),e=>e.status===400);
 await x.cmd('payments',{...body,items:[{commissionId:c.id,amountCents:3500000}],amountCents:3500000});
 const paid=(await x.call('/api/technician',undefined,token)).commissions[0];assert.equal(paid.status,'PAID');assert.equal(paid.pending_cents,0);
 await assert.rejects(x.cmd('payments',body));
});
test('Pagos concurrentes con la misma revisión: un único ganador y saldo íntegro',async()=>{
 const x=await setup(),f=await x.fixture();await x.cmd('rates',{mode:'GENERAL',defaultRate:2500,serviceRates:[],technicianRates:[]});await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});await x.invoice(f.quote);
 const c=(await x.call('/api/team')).commissions[0],body={date:'2026-09-28',method:'Efectivo',reference:'Concurrente',items:[{commissionId:c.id,amountCents:c.pending_cents}],amountCents:c.pending_cents,revision:await x.revision()};
 const replies=await Promise.all(['one','two'].map(requestId=>x.raw('/api/team/payments',{...body,requestId},x.admin)));assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);assert.equal((await x.call('/api/team')).payments.length,1);
});
test('Reversión: anular venta conserva instantánea, pagos y deuda a revisar; no permite nuevos pagos',async()=>{
 const x=await setup(),f=await x.fixture();await x.cmd('rates',{mode:'GENERAL',defaultRate:2500,serviceRates:[],technicianRates:[]});await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});const sale=(await x.invoice(f.quote)).result;
 const c=(await x.call('/api/team')).commissions[0];await x.cmd('payments',{date:'2026-09-28',method:'Efectivo',reference:'Abono',items:[{commissionId:c.id,amountCents:100}],amountCents:100});
 await x.call('/api/transactions',{revision:await x.revision(),requestId:'reverse',changes:[{type:'sales',remove:true,id:sale.id}]});
 const data=await x.call('/api/team');assert.equal(data.commissions[0].status,'REVERSED');assert.equal(data.commissions[0].snapshot_json,c.snapshot_json);assert.equal(data.reversals[0].paid_amount_cents,100);assert.equal(data.reversals[0].recorded_by_user_id,'owner');assert.equal(data.payments.length,1);
 await assert.rejects(x.cmd('payments',{date:'2026-09-28',method:'Efectivo',reference:'Inválido',items:[{commissionId:c.id,amountCents:1}],amountCents:1}));
});
test('Limpieza operativa conserva auditoría y revierte comisiones pendientes',async()=>{
 const x=await setup(),f=await x.fixture();await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});await x.invoice(f.quote);
 await x.call('/api/admin/clean',{revision:await x.revision(),requestId:'clean-team'});const data=await x.call('/api/team');assert.equal(data.orders.length,0);assert.equal(data.commissions.length,1);assert.equal(data.reversals.length,1);assert.equal(data.commissions[0].status,'REVERSED');assert.ok(data.accounts.length);
});
test('Importes: centavos decimales se calculan sin rechazar 0.29 por representación binaria',()=>{
 const result=calculateInvoiceCommissions({sale:{id:'s',origin:'TALLER',orderId:'o',quoteId:'q',discount:0,items:[{id:'line',kind:'service',name:'Centavos',price:0.29,quantity:1}]},assignments:[{id:'a',work_order_id:'o',assignment_key:'line',technician_id:'t'}],technicians:[{id:'t',name:'Ana'}],settings:{mode:'GENERAL',default_rate_basis_points:10000}});assert.equal(result[0].commission_amount_cents,29);
});
test('Servicios heredados: referencia de catálogo explícita y estable aplica su porcentaje',async()=>{
 const x=await setup(),f=await x.fixture();delete f.order.items[0].serviceId;delete f.quote.items[0].serviceId;
 await x.env.DB.batch(prepared(x.env.DB,[...writeEntity('demo','orders',f.order),...writeEntity('demo','quotes',f.quote)]));
 await x.cmd('rates',{mode:'SERVICE',defaultRate:1000,serviceRates:[{service_id:f.service.id,rate_basis_points:3350}],technicianRates:[]});
 await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id,serviceId:f.service.id}]});
 await x.invoice(f.quote);const c=(await x.call('/api/team')).commissions[0];assert.equal(c.service_id,f.service.id);assert.equal(c.rate_basis_points,3350);assert.equal(c.order_number,f.order.number);assert.ok(c.invoice_number.startsWith('V-'));
});
test('Contraseña renovada revoca sesión anterior y cambio de identidad se rechaza',async()=>{
 const x=await setup(),f=await x.fixture(),token=await x.account('ana',f.tech.id),newPassword=crypto.randomUUID();
 await x.cmd('accounts',{userId:'ana',name:'Ana',role:'TECNICO',enabled:true,password:newPassword,technicianId:f.tech.id});
 assert.equal((await x.raw('/api/technician',undefined,token)).status,401);assert.equal((await x.raw('/api/session',{userId:'ana',password})).status,401);
 assert.equal((await x.raw('/api/session',{userId:'ana',password:newPassword})).status,200);
 await assert.rejects(x.cmd('accounts',{userId:'ana',name:'Ana',role:'TECNICO',enabled:true,technicianId:f.other.id}));
});
test('Segunda cotización del mismo servicio no duplica comisión y revierte toda la venta',async()=>{
 const x=await setup(),f=await x.fixture();await x.cmd('assignments',{orderId:f.order.id,assignments:[{assignmentKey:'line-team',technicianId:f.tech.id}]});await x.invoice(f.quote);
 const q={...f.quote,id:'second-quote'};await x.env.DB.batch(prepared(x.env.DB,writeEntity('demo','quotes',q)));const before=await loadState(x.env.DB,'demo');
 await assert.rejects(x.invoice(q),e=>e.status===409);assert.deepEqual(await loadState(x.env.DB,'demo'),before);assert.equal((await x.call('/api/team')).commissions.length,1);
});
