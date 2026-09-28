// Only the explicitly named TallerPro deployment. Does not access any other project.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='https://api-tallerpro-demo.fastedwardmr.workers.dev';
const {DEMO_ACCESS_CODE}=JSON.parse(readFileSync('.wrangler/tallerpro-secrets.json','utf8'));let token='';
async function call(path,body){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:'https://talleres-autos-demo.pages.dev',...(token?{Authorization:'Bearer '+token}:{}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});const result=await r.json();if(!r.ok||!result.ok)throw new Error(`${path}: ${r.status} ${result.error?.message}`);return result.data;}
const health=await call('/api/health');assert.equal(health.service,'api-tallerpro-demo');token=(await call('/api/session',{code:DEMO_ACCESS_CODE})).token;
let loaded=await call('/api/state');const counts=Object.fromEntries(['clients','vehicles','orders','products','services','sales','appointments','technicians','quotes'].map(k=>[k,loaded.state[k].length]));
for(const plate of ['ABC123','ABC 123','abc123'])assert.equal((await call('/api/vehicles/plate/'+encodeURIComponent(plate))).records.id,'v1');
if(process.argv.includes('--write')){
 const commit=async(requestId,changes)=>{loaded=await call('/api/transactions',{revision:loaded.revision,requestId,changes});};
 const customer={id:'qa-cloud-customer',name:'Cliente prueba CLOUD',document:'QA-CLOUD-2026',phone:'3000000000',email:'demo@example.com',active:true,notes:'Dato ficticio de verificación V0.3'};
 if(!loaded.state.clients.some(c=>c.id===customer.id))await commit('qa-create-customer',[{type:'clients',value:customer}]);
 const vehicle={...loaded.state.vehicles[0],id:'qa-cloud-vehicle',vehicle_id:'qa-cloud-vehicle',plate:'QAC 303',ownerId:customer.id,customer_id:customer.id,photos:[],documents:[],reminders:[]};
 if(!loaded.state.vehicles.some(v=>v.id===vehicle.id))await commit('qa-create-vehicle',[{type:'vehicles',value:vehicle}]);
 const order={...loaded.state.orders[0],id:'qa-cloud-order',number:'OT-99003',vehicleId:vehicle.id,clientId:customer.id,date:'2026-09-17',delivery:'2026-09-18',status:'RECIBIDO',diagnosis:'Verificación CLOUD',items:[{id:'qa-cloud-item',name:'Diagnóstico de prueba',price:150000,quantity:1,kind:'service',technicianId:'t1',status:'PENDIENTE',notes:''}],inspection:{reason:'Prueba integral V0.3',fuel:'50%',damage:[],photos:[]},events:[{date:new Date().toISOString(),text:'Recepción CLOUD verificada'}]};
 if(!loaded.state.orders.some(o=>o.id===order.id))await commit('qa-create-order',[{type:'orders',value:order}]);
 const current=loaded.state.vehicles.find(v=>v.id===vehicle.id);
 if(!current.photos.length){const form=new FormData();form.append('image',new Blob([readFileSync('tests/fixtures/vehicle-demo.png')],{type:'image/png'}),'vehicle-demo.png');form.append('vehicleId',vehicle.id);form.append('label','Fotografía ficticia de prueba V0.3');const photo=await call('/api/files',form);await commit('qa-attach-photo',[{type:'vehicles',value:{...current,photos:[photo]}}]);}
 if(!loaded.state.sales.some(s=>s.clientId===customer.id)){loaded=await call('/api/sales',{revision:loaded.revision,requestId:'qa-cloud-checkout',sale:{clientId:customer.id,vehicleId:vehicle.id,date:'2026-09-17',discount:0,tax:0,method:'Efectivo',items:[{productId:'p1',name:'Aceite sintético 5W-30',quantity:1,price:125000,kind:'product'}]}});}
 // New authenticated session reads server data; no browser/localStorage involved.
 token=(await call('/api/session',{code:DEMO_ACCESS_CODE})).token;loaded=await call('/api/state');assert.equal(loaded.state.vehicles.find(v=>v.id===vehicle.id).plate,'QAC303');assert.equal((await call('/api/vehicles/'+vehicle.id+'/history')).records[0].id,order.id);
 const image=await fetch(loaded.state.vehicles.find(v=>v.id===vehicle.id).photos[0].url);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.equal(loaded.state.products.find(p=>p.id==='p1').stock,11);
 console.log('D1 remoto: cliente → vehículo → recepción/orden → trabajo; POS/stock; segunda sesión y foto R2: PASS');
}
mkdirSync('test-artifacts',{recursive:true});writeFileSync('test-artifacts/cloud-smoke.json',JSON.stringify({at:new Date().toISOString(),base,counts,revision:loaded.revision,write:process.argv.includes('--write'),passed:true},null,2));console.log(JSON.stringify({health,counts,revision:loaded.revision,passed:true}));
