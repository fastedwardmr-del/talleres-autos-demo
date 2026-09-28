import {fail,validId} from './validation.js';
import {fileUrl} from './auth.js';
export const MAX_IMAGE=1500000;
export function imageMime(bytes){if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';return '';}
export async function uploadFile(request,env,company){const form=await request.formData(),file=form.get('image'),vehicleId=form.get('vehicleId'),receptionId=form.get('receptionId')||null;
 if(!(file instanceof Blob)||!file.size||file.size>MAX_IMAGE||!['image/jpeg','image/png','image/webp'].includes(file.type))fail('Usa JPEG, PNG o WebP de hasta 1,5 MB.');
 if(!validId(vehicleId)||!await env.DB.prepare('SELECT id FROM vehicles WHERE company_id=? AND id=?').bind(company,vehicleId).first())fail('Vehículo no encontrado en este taller.');
 if(receptionId&&(!validId(receptionId)||!await env.DB.prepare('SELECT r.id FROM receptions r JOIN work_orders o ON o.company_id=r.company_id AND o.id=r.work_order_id WHERE r.company_id=? AND r.id=? AND o.vehicle_id=?').bind(company,receptionId,vehicleId).first()))fail('Recepción no encontrada.');
 const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM files WHERE company_id=? AND vehicle_id=?').bind(company,vehicleId).first();if(count.total>=80)fail('Este vehículo alcanzó el límite de fotos de la demo.');
 const bytes=new Uint8Array(await file.arrayBuffer());if(imageMime(bytes)!==file.type)fail('El contenido no corresponde al tipo de imagen.');
 const id='file-'+crypto.randomUUID(),ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],key=`companies/${company}/${receptionId?'receptions/'+receptionId:'vehicles/'+vehicleId}/${id}.${ext}`;
 await env.FILES.put(key,bytes,{httpMetadata:{contentType:file.type},customMetadata:{company_id:company,vehicle_id:vehicleId}});
 try{await env.DB.prepare('INSERT INTO files(company_id,id,object_key,vehicle_id,reception_id,mime,size,label) VALUES(?,?,?,?,?,?,?,?)').bind(company,id,key,vehicleId,receptionId,file.type,file.size,String(form.get('label')||'Fotografía').slice(0,100)).run();}catch(e){await env.FILES.delete(key);throw e;}
 return {fileId:id,label:String(form.get('label')||'Fotografía').slice(0,100),url:await fileUrl(new URL(request.url).origin,id,company,env.SESSION_SECRET)};
}
export async function validatePhotos(state,db,company){const files=(await db.prepare('SELECT id,vehicle_id,reception_id FROM files WHERE company_id=?').bind(company).all()).results;const check=(list,vehicleId,receptionId)=>{if(!Array.isArray(list)||list.length>8)fail('Máximo ocho fotos por ficha o recepción.');for(const p of list){const f=files.find(f=>f.id===p.fileId);if(!f||f.vehicle_id!==vehicleId||(f.reception_id&&f.reception_id!==receptionId))fail('Foto no encontrada o asociada a otro vehículo.');delete p.url;}};for(const v of state.vehicles)check(v.photos,v.id,null);for(const o of state.orders)check(o.inspection.photos||[],o.vehicleId,o.id);}
export async function hydratePhotos(state,origin,secret){for(const list of [...state.vehicles.map(v=>v.photos),...state.orders.map(o=>o.inspection.photos)])for(const p of list||[])p.url=await fileUrl(origin,p.fileId,state.company_id,secret);return state;}
