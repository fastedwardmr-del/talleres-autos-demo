import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceCommissionStatements} from '../backend/cloud/commissionBilling.js';
const sale={id:'sale-1',origin:'TALLER',quoteId:'q1',orderId:'o1',discount:0,items:[{id:'line1',kind:'service',name:'Frenos',price:100,quantity:1},{id:'p1',kind:'product',name:'Pastillas',price:50,quantity:1}]};
const state={quotes:[{id:'q1',orderId:'o1'}],orders:[{id:'o1',items:[{id:'line1',kind:'service',name:'Frenos'}]}],technicians:[{id:'t1',name:'Ana'}]};
function fakeDb(assignments){return {prepare(sql){return {bind(){return {first:async()=>sql.includes('commission_settings')?{mode:'GENERAL',default_rate_basis_points:2500}:null,all:async()=>({results:sql.includes('work_order_assignments')?assignments:[]})}}}}};}
test('No genera comisión sin asignaciones',async()=>assert.deepEqual(await invoiceCommissionStatements(fakeDb([]),'demo',sale,state),[]));
test('Factura asignada produce inserción con 25% sobre servicio sin repuestos',async()=>{const rows=await invoiceCommissionStatements(fakeDb([{id:'a1',work_order_id:'o1',assignment_key:'line1',technician_id:'t1',service_id:''}]),'demo',sale,state);assert.equal(rows.length,1);assert.match(rows[0].sql,/INSERT INTO technician_commissions/);assert.equal(rows[0].values.at(-2),2500);assert.equal(rows[0].values.at(-1),'PENDING');assert.ok(rows[0].values.includes(2500));});
test('Rechaza asignación obsoleta y no crea comisiones',async()=>await assert.rejects(()=>invoiceCommissionStatements(fakeDb([{id:'a1',work_order_id:'o1',assignment_key:'removed',technician_id:'t1'}]),'demo',sale,state),/ya no corresponde/));
test('POS no genera comisiones',async()=>assert.deepEqual(await invoiceCommissionStatements(fakeDb([]),'demo',{...sale,origin:'POS'},state),[]));
