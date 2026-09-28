import {getIntegrations,requestJSON} from './integrationClient.js';
import {normalizePlate,validPlate} from './vehicleIdentity.js';
export function createLookupService({fetcher=globalThis.fetch,status=()=>getIntegrations(fetcher)}={}){return {status,async lookup({plate,ownerDocument='',consent=false}){
 plate=normalizePlate(plate);if(!validPlate(plate))throw new Error('Ingresa una placa válida.');
 const settings=await status();
 if(settings.lookup.mode!=='real')return {plate,source:'unconfigured',notice:'Consulta vehicular no configurada. Puedes usar el catálogo o registrar manualmente.'};
 if(settings.lookup.requiresDocument&&!ownerDocument.trim())return {plate,requiresDocument:true,notice:'Este proveedor requiere el documento del propietario.'};
 if(!consent)throw new Error('Autoriza la consulta externa antes de enviar los datos.');
 try{return await requestJSON('/api/vehicle-lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plate,ownerDocument,consent})},fetcher);}
 catch{return {plate,source:'unavailable',notice:'No fue posible consultar. Conservamos tus datos; continúa con catálogo o registro manual.'};}
}};}
export const vehicleLookupService=createLookupService();
