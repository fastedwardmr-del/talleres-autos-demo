export const normalizePlate = value => String(value ?? '').normalize('NFKC').toUpperCase().replace(/[\s-]/g, '');
export const validPlate = value => /^[A-Z]{3}\d{2}[A-Z0-9]$/.test(normalizePlate(value));
export const findVehicleByPlate = (vehicles, value) => vehicles.find(v => normalizePlate(v.plate) === normalizePlate(value));
export const plateMatches = (plate, query) => normalizePlate(query) !== '' && normalizePlate(plate).includes(normalizePlate(query));

// id/brand/ownerId siguen siendo aliases para los módulos V0.1.
export function normalizeVehicle(value, previous = null, now = new Date().toISOString()) {
  if(value.id&&value.vehicle_id&&value.id!==value.vehicle_id)throw new Error('El identificador interno del vehículo no se puede cambiar.');
  if (previous && ((value.vehicle_id && value.vehicle_id !== previous.id) || (value.id && value.id !== previous.id))) {
    throw new Error('El identificador interno del vehículo no se puede cambiar.');
  }
  const id = previous?.id || value.id || value.vehicle_id || `vehicle-${crypto.randomUUID()}`;
  const make = value.make ?? value.brand ?? previous?.make ?? '';
  const customerId = value.customer_id ?? value.ownerId ?? previous?.customer_id ?? '';
  return {photos:[],documents:[],reminders:[],active:true,type:'Automóvil',version:'',vin:'',engine:'',displacement:'',fuel:'',transmission:'',drive:'',bodyType:'',color:'',
    ...previous,...value,id,vehicle_id:id,plate:normalizePlate(value.plate ?? previous?.plate),make,brand:make,customer_id:customerId,ownerId:customerId,
    year:Number(value.year ?? previous?.year)||'',mileage:Number(value.mileage ?? previous?.mileage)||0,
    created_at:previous?.created_at || value.created_at || now,updated_at:now};
}

export function recognitionPrefill(result) {
  return {plate:normalizePlate(result.plate),make:result.make||'',brand:result.make||'',model:result.model||'',color:result.color||'',bodyType:result.bodyType||'',year:'',version:'',recognitionSource:result.source||'demo'};
}

export function vehicleLabel(make,model){make=String(make||'');model=String(model||'');return model.toLowerCase().startsWith(make.toLowerCase()+' ')?model:[make,model].filter(Boolean).join(' ');}
