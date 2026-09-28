import {getIntegrations,requestJSON} from './integrationClient.js';
import {normalizePlate} from './vehicleIdentity.js';
export function demoRecognition(scenario='known'){
 const unknown=scenario==='unknown';
 return {plate:unknown?'ZZZ999':'ABC123',plateConfidence:.98,make:unknown?'Toyota':'Mazda',model:unknown?'Corolla':'Mazda 3',vehicleConfidence:.91,color:unknown?'Blanco':'Gris',bodyType:'Sedán',source:'demo',simulated:true,notice:'Resultado DEMO ilustrativo. No se ha analizado el contenido de la fotografía.'};
}
export function validateRecognition(result){
 if(!result||typeof result.plate!=='string')throw new Error('Respuesta de reconocimiento no válida.');
 const score=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):null;
 return {plate:normalizePlate(result.plate),plateConfidence:score(result.plateConfidence),make:String(result.make||''),model:String(result.model||''),vehicleConfidence:score(result.vehicleConfidence),color:String(result.color||''),bodyType:String(result.bodyType||''),source:result.source||'remote',simulated:result.simulated===true,notice:String(result.notice||'')};
}
export function createRecognitionService({fetcher=globalThis.fetch,status=()=>getIntegrations(fetcher)}={}){return {
 status,
 async analyze(file,{scenario='known',consent=false}={}){
   if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Selecciona una imagen JPG, PNG o WebP.');
   if(file.size>1500000)throw new Error('La fotografía debe pesar menos de 1,5 MB.');
   const settings=await status();
   if(settings.recognition.mode!=='real')return demoRecognition(scenario);
   if(!consent)throw new Error('Confirma que la foto será procesada por Plate Recognizer o utiliza el modo DEMO.');
   const data=new FormData();data.append('image',file,'vehicle.'+file.type.split('/')[1]);data.append('consent','true');
   return validateRecognition(await requestJSON('/api/vehicle-recognition',{method:'POST',body:data},fetcher,18000));
 }
};}
export const vehicleRecognitionService=createRecognitionService();
