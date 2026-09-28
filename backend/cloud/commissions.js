/** Pure commission calculation. All money is integer COP cents; all rates basis points.
 * No DB writes: caller must insert results in the SAME D1 batch as invoice creation.
 */
const integer=(v,label)=>{if(!Number.isSafeInteger(v)||v<0)throw new Error(`${label} inválido.`);return v;};
export function resolveCommissionRate({mode='GENERAL',defaultRate=0,serviceRate=null,technicianRate=null,technicianServiceRate=null}){
  const rate=technicianServiceRate??technicianRate??(mode==='SERVICE'?serviceRate:null)??defaultRate;
  if(!Number.isInteger(rate)||rate<0||rate>10000)throw new Error('Porcentaje de comisión inválido.');
  return rate;
}
/** Compute one immutable snapshot for each assignment matched to an invoiced service line.
 * assignment_key MUST be a stable service item id preserved from OT through quote and sale.
 * discount applies proportionally to service line; tax and product lines are excluded.
 */
export function calculateInvoiceCommissions({sale,assignments,technicians,settings,serviceRates=[],technicianRates=[]}){
  if(sale.origin!=='TALLER'||!sale.quoteId||!sale.orderId)return [];
  if(!Array.isArray(sale.items)||!Array.isArray(assignments))throw new Error('Venta o asignaciones inválidas.');
  const discount=Number(sale.discount||0);
  if(!Number.isFinite(discount)||discount<0||discount>100)throw new Error('Descuento inválido.');
  const techniciansById=new Map(technicians.map(t=>[t.id,t]));
  const servicesById=new Map(serviceRates.map(r=>[r.service_id,r.rate_basis_points]));
  const ratesByKey=new Map(technicianRates.map(r=>[`${r.technician_id}:${r.service_id||''}`,r.rate_basis_points]));
  const lines=new Map();
  for(const item of sale.items){
    if(item.kind!=='service')continue;
    if(!item.id||lines.has(item.id))throw new Error('Cada servicio facturado necesita un identificador único y estable.');
    if(!Number.isSafeInteger(Number(item.price)*100)||!Number.isSafeInteger(Number(item.quantity)*100)||Number(item.price)<0||Number(item.quantity)<=0)throw new Error('Precio o cantidad de servicio inválidos.');
    lines.set(item.id,item);
  }
  const used=new Set();
  return assignments.map(a=>{
    if(a.work_order_id!==sale.orderId)throw new Error('Asignación de otra orden.');
    if(used.has(a.id))throw new Error('Asignación duplicada.');used.add(a.id);
    const item=lines.get(a.assignment_key),technician=techniciansById.get(a.technician_id);
    if(!item||!technician)throw new Error('Servicio o técnico asignado no existe en la factura.');
    const serviceId=a.service_id||item.catalogId||item.serviceId||'';
    const rate=resolveCommissionRate({mode:settings.mode,defaultRate:settings.default_rate_basis_points,serviceRate:servicesById.get(serviceId),technicianRate:ratesByKey.get(`${technician.id}:`),technicianServiceRate:ratesByKey.get(`${technician.id}:${serviceId}`)});
    const gross=integer(Math.round(Number(item.price)*Number(item.quantity)*100),'Base');
    const base=integer(Math.round(gross*(100-discount)/100),'Base descontada');
    const amount=integer(Math.round(base*rate/10000),'Comisión');
    return {sale_id:sale.id,work_order_id:sale.orderId,assignment_id:a.id,assignment_key:a.assignment_key,technician_id:technician.id,technician_name:technician.name,service_id:serviceId||null,service_name:item.name,base_amount_cents:base,rate_basis_points:rate,commission_amount_cents:amount,status:'PENDING'};
  });
}
