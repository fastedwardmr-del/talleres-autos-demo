import {recognizePhoto,createCarApiAdapter,lookupVehicle} from './providers.js';
import {normalizePlate,validPlate} from '../js/services/vehicleIdentity.js';
export const MAX_BODY=1600000;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createApiHandler(){const catalog=createCarApiAdapter(),last={};let inFlight=0;const calls=[];
 return async function handleApi(request,env={},fetcher=fetch){
 const url=new URL(request.url),origin=request.headers.get('origin');
 if(origin&&origin!==url.origin)return json({error:'Origen no permitido'},403);
 if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Origen no permitido'},403);
 const configured={recognition:!!env.PLATE_RECOGNIZER_TOKEN,catalog:!!(env.CARAPI_TOKEN&&env.CARAPI_SECRET),lookup:!!(env.VEHICLE_LOOKUP_URL&&env.VEHICLE_LOOKUP_TOKEN)};
 if(url.pathname==='/api/integrations'&&request.method==='GET')return json({recognition:{mode:configured.recognition?'real':'demo',provider:'Plate Recognizer',state:configured.recognition?(last.recognition||'CONFIGURADO · SIN VERIFICAR'):'MODO DEMO'},catalog:{mode:configured.catalog?'real':'local',provider:configured.catalog?'CarAPI':'Catálogo TallerPro',state:configured.catalog?(last.catalog||'CONFIGURADO · SIN VERIFICAR'):'CATÁLOGO LOCAL'},lookup:{mode:configured.lookup?'real':'unconfigured',provider:'Proveedor autorizado',requiresDocument:env.VEHICLE_LOOKUP_REQUIRES_DOCUMENT==='true',state:configured.lookup?(last.lookup||'CONFIGURADO · SIN VERIFICAR'):'NO CONFIGURADO'},qr:{state:'ACTIVO'}});
 const routes={'/api/vehicle-recognition':['POST','recognition'],'/api/vehicle-catalog':['GET','catalog'],'/api/vehicle-lookup':['POST','lookup']};
 const route=routes[url.pathname];if(!route)return json({error:'No encontrado'},404);if(request.method!==route[0])return json({error:'Método no permitido'},405);
 const key=route[1];if(!configured[key])return json({error:'Integración no configurada. Usa DEMO/local.'},503);
 if(Number(request.headers.get('content-length'))>MAX_BODY)return json({error:'Archivo demasiado grande'},413);
 while(calls.length&&calls[0]<Date.now()-60000)calls.shift();if(inFlight>=3||calls.length>=30)return json({error:'Espera antes de reintentar'},429);calls.push(Date.now());inFlight++;
 try{
   let result;
   if(key==='recognition'){
     if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))return json({error:'Formato no válido'},400);
     const bytes=await request.arrayBuffer();if(bytes.byteLength>MAX_BODY)return json({error:'Archivo demasiado grande'},413);
     const form=await new Request(url,{method:'POST',headers:request.headers,body:bytes}).formData(),image=form.get('image');
     if(form.get('consent')!=='true')return json({error:'Se requiere autorización para procesar la foto'},400);
     if(!(image instanceof Blob)||!['image/jpeg','image/png','image/webp'].includes(image.type)||image.size>1500000||!image.size)return json({error:'Imagen no válida'},400);
     result=await recognizePhoto(image,env,fetcher);
   }else if(key==='catalog'){
     const s=Object.fromEntries(url.searchParams);if(!['makes','years','models','versions','specs'].includes(s.level))return json({error:'Nivel no válido'},400);
     result=await catalog.query(s.level,s,env,fetcher);
   }else{
     const bodyText=await request.text();if(bodyText.length>2000)return json({error:'Solicitud demasiado grande'},413);
     const body=JSON.parse(bodyText),plate=normalizePlate(body.plate);
     if(!validPlate(plate)||body.consent!==true)return json({error:'Placa o autorización no válidas'},400);
     if(env.VEHICLE_LOOKUP_REQUIRES_DOCUMENT==='true'&&!String(body.ownerDocument||'').trim())return json({error:'Documento requerido'},400);
     result=await lookupVehicle({plate,ownerDocument:String(body.ownerDocument||'').slice(0,40)},env,fetcher);
   }
   last[key]='CONECTADO';return json(result);
 }catch(error){last[key]='NO DISPONIBLE';return json({error:error.status===429?'Límite del proveedor agotado.':'Proveedor no disponible. Continúa con los datos locales o el registro manual.'},error.status||502);}
 finally{inFlight--;}
 };
}
export const handleApi=createApiHandler();
