import {normalizePlate} from '../js/services/vehicleIdentity.js';
const text=value=>typeof value==='string'?value.slice(0,150):'';
const score=value=>Number.isFinite(value)?Math.min(1,Math.max(0,value)):null;
const translated={Sedan:'Sedán',SUV:'SUV',Pickup:'Pickup',Truck:'Camión',Van:'Van',Motorcycle:'Motocicleta',Hatchback:'Hatchback',blue:'Azul',white:'Blanco',black:'Negro',silver:'Plateado',gray:'Gris',red:'Rojo',green:'Verde',yellow:'Amarillo',brown:'Marrón'};
export function normalizePlateRecognizer(payload){
 if(!Array.isArray(payload?.results))throw new Error('Invalid provider response');
 const r=[...payload.results].sort((a,b)=>(b.score||0)-(a.score||0))[0];
 if(!r)return {plate:'',plateConfidence:null,make:'',model:'',vehicleConfidence:null,color:'',bodyType:'',source:'Plate Recognizer',notice:'No se detectó una placa. Prueba otra foto o ingrésala manualmente.'};
 const mm=[...(r.model_make||[])].sort((a,b)=>(b.score||0)-(a.score||0))[0]||{};
 const color=[...(r.color||[])].sort((a,b)=>(b.score||0)-(a.score||0))[0]?.color||'';
 return {plate:normalizePlate(r.plate),plateConfidence:score(r.score),make:mm.make==='Generic'?'':text(mm.make),model:mm.model==='Unknown'?'':text(mm.model),vehicleConfidence:score(mm.score),color:translated[color]||text(color),bodyType:translated[r.vehicle?.type]||text(r.vehicle?.type),source:'Plate Recognizer',simulated:false,notice:payload.results.length>1?'Se detectaron varios vehículos; revisa la placa seleccionada (mayor confianza).':''};
}
async function jsonFetch(url,options,fetcher){const response=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok){const error=new Error('Provider unavailable');error.status=response.status===429?429:502;throw error;}return response.json();}
export async function recognizePhoto(image,env,fetcher=fetch){
 const form=new FormData();form.append('upload',image,'vehicle.jpg');form.append('regions','co');if(env.PLATE_RECOGNIZER_MMC==='true')form.append('mmc','true');
 return normalizePlateRecognizer(await jsonFetch('https://api.platerecognizer.com/v1/plate-reader/',{method:'POST',headers:{Authorization:`Token ${env.PLATE_RECOGNIZER_TOKEN}`},body:form},fetcher));
}
export function normalizeCarApiSpecs(r){
 const engine=r.engines?.[0]||{},fuel=engine.fuel_type||'',transmission=r.transmissions?.[0]?.description||'',drive=r.drive_types?.[0]?.description||'',body=r.bodies?.[0]?.type||'';
 return {id:`remote:${r.id}`,make:text(r.make),model:text(r.model),year:Number(r.year),version:text(r.trim||r.description),bodyType:translated[body]||text(body),engine:text(engine.cylinders),displacement:engine.size?`${engine.size} L`:'',fuel:/diesel/i.test(fuel)?'Diésel':/electric/i.test(fuel)?'Eléctrico':/unleaded|gasoline/i.test(fuel)?'Gasolina':text(fuel),transmission:/automatic/i.test(transmission)?'Automática':/manual/i.test(transmission)?'Manual':text(transmission),drive:/front wheel/i.test(drive)?'Delantera':/rear wheel/i.test(drive)?'Trasera':/all wheel/i.test(drive)?'Integral':text(drive),source:'CarAPI',verified:false};
}
export function createCarApiAdapter(){let jwt='',expires=0;return {async query(level,s,env,fetcher=fetch){
 if(Date.now()>expires){const response=await fetcher('https://carapi.app/api/auth/login',{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json'},body:JSON.stringify({api_token:env.CARAPI_TOKEN,api_secret:env.CARAPI_SECRET})});if(!response.ok)throw new Error('Authentication failed');jwt=(await response.text()).replace(/^"|"$/g,'');expires=Date.now()+15*60*1000;}
 const paths={makes:'makes/v2',years:'years/v2',models:'models/v2',versions:'trims/v2',specs:`trims/v2/${String(s.versionId||'').replace('remote:','')}`};
 if(!paths[level]||(level==='specs'&&!/^remote:\d+$/.test(s.versionId||'')))throw new Error('Invalid catalog query');
 const query=new URLSearchParams({limit:'100'});for(const key of ['make','year','model'])if(s[key])query.set(key,s[key]);
 let payload;try{payload=await jsonFetch(`https://carapi.app/api/${paths[level]}?${query}`,{headers:{Authorization:`Bearer ${jwt}`}},fetcher);}catch(e){jwt='';expires=0;throw e;}
 if(level==='specs')return {items:normalizeCarApiSpecs(payload),source:'CarAPI',notice:'Datos del proveedor. Confirma versión y especificaciones para Colombia.'};
 const data=payload.data;if(!Array.isArray(data))throw new Error('Invalid catalog response');
 const items=data.map(r=>level==='years'?{value:String(typeof r==='number'?r:r.year),label:String(typeof r==='number'?r:r.year)}:level==='versions'?{value:`remote:${r.id}`,label:text(r.description||r.trim)}:{value:text(r.name),label:text(r.name)}).filter(r=>r.value&&r.value!=='undefined');
 return {items,source:'CarAPI',notice:'Catálogo externo de vehículos livianos; la cobertura colombiana no está garantizada. Puedes usar el catálogo local o el registro manual.'};
 }};}
export async function lookupVehicle({plate,ownerDocument},env,fetcher=fetch){
 const url=new URL(env.VEHICLE_LOOKUP_URL);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Invalid lookup endpoint');
 const payload=await jsonFetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.VEHICLE_LOOKUP_TOKEN}`},body:JSON.stringify({plate,ownerDocument})},fetcher);
 const result={plate,source:'Consulta externa'};for(const key of ['make','model','version','vin','engine','displacement','fuel','transmission','drive','bodyType','color'])result[key]=text(payload[key]);
 if(Number(payload.year)>=1900&&Number(payload.year)<=2100)result.year=Number(payload.year);
 return result;
}
