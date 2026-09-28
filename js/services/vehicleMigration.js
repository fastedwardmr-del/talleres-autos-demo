import {normalizeVehicle} from './vehicleIdentity.js';
import {localCatalog,canonicalModel} from '../data/vehicleCatalog.js';

export function migrateVehicles(data, now = new Date().toISOString()) {
 if(data.schemaVersion>=2)return data;
 data.vehicles=data.vehicles.map(v=>{
   const record=normalizeVehicle(v,null,v.created_at||now);
   const candidate=localCatalog.find(r=>r.make===v.brand&&r.model===canonicalModel(v.brand,v.model)&&r.year===Number(v.year));
   // Solo corregir la firma exacta del seed V0.1; no sobreescribir ediciones del usuario.
   const originalDemo=/^v\d+$/.test(v.id)&&/^9FCDEMO/.test(v.vin||'')&&v.version==='Touring'&&v.engine==='2.0 L';
   if(candidate){record.type=v.type||candidate.type;record.bodyType=v.bodyType||candidate.bodyType;}
   if(originalDemo&&candidate){record.legacyDemoSpecs={version:v.version,engine:v.engine,fuel:v.fuel,transmission:v.transmission};record.model=candidate.model;record.version=candidate.version;record.engine='';record.fuel=candidate.fuel;record.transmission='';record.specificationSource='local-demo';}
   return record;
 });
 data.schemaVersion=2;
 return data;
}
