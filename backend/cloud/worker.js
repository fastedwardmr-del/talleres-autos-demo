import {createApiHandler} from '../api.js';
import {entities,jsonCopy} from './model.js';
import {loadState,commitState,cleanOperationalData} from './repository.js';
import {invoiceCommissionStatements} from './commissionBilling.js';
import {applyChanges,validateState,validateTenant,fail,validId} from './validation.js';
import {authenticate,authenticateFile,login} from './auth.js';
import {uploadFile,validatePhotos,hydratePhotos} from './files.js';
import {DemoStore} from '../../js/services/localStore.js';
import {normalizePlate} from '../../js/services/vehicleIdentity.js';
import {queryCatalog,validateCatalogVehicle} from './catalog.js';
import {findVehicleImage} from './vehicleImages.js';
const integration=createApiHandler();
const response=(data,status=200)=>Response.json({ok:true,data},{status,headers:{'Cache-Control':'no-store'}});
const errorResponse=e=>Response.json({ok:false,error:{code:e.code||'SERVER_ERROR',message:e.code?e.message:'No fue posible guardar los datos. Intenta nuevamente.'}},{status:e.status||500});
const routes={customers:'clients',vehicles:'vehicles','work-orders':'orders',quotes:'quotes',products:'products',services:'services',inventory:'movements',sales:'sales',appointments:'appointments',technicians:'technicians'};
async function boundedBody(request,max=1600000){const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail('Solicitud demasiado grande.','TOO_LARGE',413);}parts.push(value);}const result=new Uint8Array(size);let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;}
async function snapshot(env,company,origin){const loaded=await loadState(env.DB,company);await hydratePhotos(loaded.state,origin,env.SESSION_SECRET);return loaded;}
export async function handleCloud(request,env){const url=new URL(request.url),origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);let output;
 try{
  if(origin&&!allowed.includes(origin)&&origin!==url.origin)fail('Origen no permitido.','ORIGIN',403);
  if(request.method==='OPTIONS')output=new Response(null,{status:204});
  else {
   const bytes=!['GET','HEAD'].includes(request.method)?await boundedBody(request):null;
   if(bytes)request=new Request(request.url,{method:request.method,headers:request.headers,body:bytes});
   if(url.pathname==='/api/health')output=response({service:'api-tallerpro-demo',version:'0.4.0'});
   else if(url.pathname.startsWith('/api/catalog/')&&request.method==='GET')output=response(await queryCatalog(env.DB,url));
   else if(url.pathname==='/api/vehicle-image'&&request.method==='GET'){const found=await findVehicleImage(url);output=Response.json({ok:true,data:found},{headers:{'Cache-Control':'public, max-age=3600, s-maxage=86400'}});}
   else if(url.pathname==='/api/session'&&request.method==='POST'){const body=await request.json();output=response(await login(request,env,body.code));}
   else if(/^\/api\/files\/file-[\w-]+$/.test(url.pathname)&&request.method==='GET'){
    const company=await authenticateFile(url,env),id=url.pathname.split('/').at(-1);const file=await env.DB.prepare('SELECT * FROM files WHERE company_id=? AND id=?').bind(company,id).first();if(!file)fail('Foto no encontrada.','NOT_FOUND',404);const object=await env.FILES.get(file.object_key);if(!object)fail('Foto no disponible.','NOT_FOUND',404);output=new Response(object.body,{headers:{'Content-Type':file.mime,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
   }else{
    const session=await authenticate(request,env),company=session.company_id;if((url.searchParams.has('company_id')&&url.searchParams.get('company_id')!==company)||(request.headers.has('X-Company-Id')&&request.headers.get('X-Company-Id')!==company))fail('No puedes acceder a otro taller.','TENANT',403);
    if(url.pathname==='/api/state'&&request.method==='GET')output=response(await snapshot(env,company,url.origin));
    else if(url.pathname==='/api/files'&&request.method==='POST')output=response(await uploadFile(request,env,company),201);
    else if(url.pathname==='/api/admin/clean'&&request.method==='POST'){const body=await request.json();validateTenant(body,company);if(!validId(body.requestId)||!Number.isSafeInteger(body.revision)||body.revision<0)fail('Identificador de operación o revisión inválidos.');const loaded=await loadState(env.DB,company);if(loaded.revision!==body.revision){const done=await env.DB.prepare('SELECT result_json FROM request_receipts WHERE company_id=? AND id=?').bind(company,body.requestId).first();if(!done)fail('Otro dispositivo actualizó los datos. Actualiza y vuelve a intentarlo.','CONFLICT',409);}const cleaned=await cleanOperationalData(env.DB,company,body.revision,body.requestId);if(cleaned.objectKeys.length){try{await env.FILES.delete(cleaned.objectKeys);}catch(e){console.error('No fue posible limpiar algunos objetos R2:',String(e).slice(0,300));}}output=response({...await snapshot(env,company,url.origin),result:cleaned.result});}
    else if(['/api/integrations','/api/vehicle-recognition','/api/vehicle-catalog','/api/vehicle-lookup'].includes(url.pathname)){
      // CORS/auth already checked. Keep V0.2 provider format inside this boundary.
      const headers=new Headers(request.headers);headers.delete('origin');headers.delete('sec-fetch-site');const legacy=await integration(new Request(request,{headers}),env);const data=await legacy.json();if(url.pathname==='/api/integrations'){data.catalog={mode:'remote-free',provider:'FleetByte Catalog API',state:'GRATUITO · SIN API KEY · 0 ESCRITURAS D1'};}if(!legacy.ok)fail(data.error,'PROVIDER',legacy.status);output=response(data);
    }else if(request.method==='GET'){
     const {state,revision}=await snapshot(env,company,url.origin),[, ,route,id,extra]=url.pathname.split('/');let data;
     if(route==='companies')data=[{company_id:company,name:state.settings.workshop}];
     else if(route==='cash')data=state.cash;
     else if(route==='reminders')data=state.vehicles.flatMap(v=>v.reminders.map(r=>({...r,vehicle_id:v.id,company_id:company})));
     else if(route==='receptions')data=id?state.orders.find(o=>o.id===id)?.inspection:state.orders.map(o=>({...o.inspection,id:o.id,vehicle_id:o.vehicleId,work_order_id:o.id,company_id:company}));
     else if(route==='vehicles'&&id==='plate')data=state.vehicles.find(v=>v.plate===normalizePlate(decodeURIComponent(extra||'')));
     else if(route==='vehicles'&&extra==='history')data=state.orders.filter(o=>o.vehicleId===id);
     else if(routes[route])data=id?state[routes[route]].find(r=>r.id===id):state[routes[route]];
     if(data===undefined)fail('Registro no encontrado.','NOT_FOUND',404);output=response({records:data,revision});
    }else if(request.method==='POST'&&['/api/transactions','/api/sales'].includes(url.pathname)){
     const body=await request.json();validateTenant(body,company);if(!validId(body.requestId)||!Number.isSafeInteger(body.revision)||body.revision<0)fail('Identificador de operación o revisión inválidos.');
     const done=await env.DB.prepare('SELECT result_json FROM request_receipts WHERE company_id=? AND id=?').bind(company,body.requestId).first();
     if(done)output=response({...await snapshot(env,company,url.origin),result:JSON.parse(done.result_json)});
     else {const loaded=await loadState(env.DB,company);if(loaded.revision!==body.revision)fail('Otro dispositivo actualizó los datos. Actualiza y vuelve a intentarlo.','CONFLICT',409);let next,result={},commissionStatements=[];
      if(url.pathname==='/api/sales'){const local=new DemoStore({getItem:()=>null,setItem:()=>{}});local.data=jsonCopy(loaded.state);const sale={...body.sale,id:undefined};try{result=local.checkout(sale);}catch(e){fail(e.message);}result.company_id=company;next=local.data;validateState(next,loaded.state,{checkout:true});commissionStatements=await invoiceCommissionStatements(env.DB,company,result,loaded.state);}
      else {next=applyChanges(loaded.state,body.changes,company);for(const c of body.changes.filter(c=>c.type==='vehicles'&&!c.remove)){const v=next.vehicles.find(v=>v.id===c.value.id);await validateCatalogVehicle(env.DB,v,loaded.state.vehicles.find(old=>old.id===v.id));}}
      await validatePhotos(next,env.DB,company);const committed=await commitState(env.DB,company,loaded.state,next,body.revision,body.requestId,result,commissionStatements);result=committed.result;if(committed.objectKeys.length){try{await env.FILES.delete(committed.objectKeys);}catch(e){console.error('No fue posible limpiar algunos objetos R2 eliminados:',String(e).slice(0,300));}}output=response({...await snapshot(env,company,url.origin),result});
     }
    }else fail('Operación no disponible.','NOT_FOUND',404);
   }
  }
 }catch(e){if(!e.code)console.error('TallerPro internal error:',String(e).slice(0,600));if(e instanceof SyntaxError)e=Object.assign(new Error('Solicitud JSON inválida.'),{status:400,code:'JSON'});if(String(e).includes('UNIQUE constraint'))e=Object.assign(new Error('El registro ya existe. Actualiza antes de reintentar.'),{status:409,code:'DUPLICATE'});if(/free tier daily row (write|read) limit/i.test(String(e)))e=Object.assign(new Error('Cloudflare alcanzó el límite diario gratuito de D1. Reintenta después de las 00:00 UTC (7:00 p. m. de Colombia). El guardado no se ha confirmado.'),{status:503,code:'D1_DAILY_LIMIT'});output=errorResponse(e);}
 const headers=new Headers(output.headers);headers.set('Cache-Control',output.headers.get('Cache-Control')||'no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('Vary','Origin');if(origin&&(allowed.includes(origin)||origin===url.origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Headers','Authorization, Content-Type, X-Company-Id');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');}return new Response(output.body,{status:output.status,headers});
}
export default {fetch:handleCloud};
