import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateInvoiceCommissions,resolveCommissionRate} from '../backend/cloud/commissions.js';
const sale={id:'sale-1',origin:'TALLER',quoteId:'quote-1',orderId:'ot-1',discount:10,tax:19,items:[{id:'line-1',kind:'service',name:'Frenos',price:150000,quantity:1,serviceId:'svc-1'},{id:'part-1',kind:'product',name:'Pastillas',price:50000,quantity:1}]};
const assignment={id:'as-1',work_order_id:'ot-1',assignment_key:'line-1',technician_id:'tech-1',service_id:'svc-1'};
const input={sale,assignments:[assignment],technicians:[{id:'tech-1',name:'Carlos'}],settings:{mode:'GENERAL',default_rate_basis_points:2500}};
test('commission only for invoiced workshop services, excluding parts and tax',()=>{
 const rows=calculateInvoiceCommissions(input);assert.equal(rows.length,1);assert.equal(rows[0].base_amount_cents,13500000);assert.equal(rows[0].commission_amount_cents,3375000);assert.equal(rows[0].technician_name,'Carlos');
});
test('POS cannot generate commissions',()=>assert.deepEqual(calculateInvoiceCommissions({...input,sale:{...sale,origin:'POS'}}),[]));
test('service mode uses service rate, technician-specific rate has priority',()=>{
 assert.equal(resolveCommissionRate({mode:'SERVICE',defaultRate:1000,serviceRate:2000,technicianRate:3000,technicianServiceRate:3500}),3500);
 assert.equal(resolveCommissionRate({mode:'SERVICE',defaultRate:1000,serviceRate:2000}),2000);
 assert.equal(resolveCommissionRate({mode:'GENERAL',defaultRate:1000,serviceRate:2000}),1000);
});
test('rejects unmatched and repeated assignments',()=>{
 assert.throws(()=>calculateInvoiceCommissions({...input,assignments:[{...assignment,assignment_key:'missing'}]}),/no existe/);
 assert.throws(()=>calculateInvoiceCommissions({...input,assignments:[assignment,assignment]}),/duplicada/);
});
test('service line id must be stable and unique',()=>assert.throws(()=>calculateInvoiceCommissions({...input,sale:{...sale,items:[sale.items[0],sale.items[0]]}}),/único/));
