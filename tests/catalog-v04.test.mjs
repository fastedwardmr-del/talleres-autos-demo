import test from 'node:test';
import assert from 'node:assert/strict';
import {queryCatalog,validateCatalogVehicle} from '../backend/cloud/catalog.js';
import {createCatalogService,changeCatalogSelection} from '../js/services/vehicleCatalogService.js';
import {normalizeVehicle} from '../js/services/vehicleIdentity.js';

const calls=[];
const fetcher=async url=>{
 calls.push(String(url));
 const u=String(url);
 if(u.includes('/makes?'))return Response.json({total:1,page:1,pageSize:30,items:[{id:'mk-renault',name:'RENAULT',country:'FR'}]});
 if(u.includes('/makes/mk-renault/models/md-duster'))return Response.json({id:'md-duster',name:'DUSTER',yearStart:2019,yearEnd:2024});
 if(u.includes('/makes/mk-renault/models?'))return Response.json({total:1,page:1,pageSize:30,items:[{id:'md-duster',name:'DUSTER'}]});
 if(u.includes('/models/md-duster/variants?year=2022'))return Response.json({total:1,page:1,pageSize:30,items:[{id:'vr-duster-2022',name:'Duster 1.3 TCe CVT',year:2022}]});
 if(u.includes('/variants/vr-duster-2022'))return Response.json({id:'vr-duster-2022',name:'Duster 1.3 TCe CVT',fuelType:'Petrol',displacementCc:1332,gearboxType:'Cvt',driveType:'Fwd',bodyType:'Suv'});
 return new Response('{}',{status:404});
};
const query=route=>queryCatalog(null,new URL('https://test/api/catalog/'+route),fetcher);

test('V04 corregida: marca y modelo se consultan bajo demanda sin D1',async()=>{
 calls.length=0;const makes=await query('makes?q=ren');assert.equal(makes.source,'fleetbyte');assert.equal(makes.items[0].label,'RENAULT');
 const models=await query('models?make_id=mk-renault&q=dus');assert.equal(models.items[0].label,'DUSTER');
 assert.equal(calls.length,2);assert.ok(calls.every(x=>x.startsWith('https://fleetcatalog.disturbingbyte.pt/v1/')));
});

test('V04 corregida: años se derivan del modelo sin importar catálogo',async()=>{
 const r=await query('years?make_id=mk-renault&model_id=md-duster');assert.deepEqual(r.items.map(x=>x.value),['2024','2023','2022','2021','2020','2019']);
});

test('V04 corregida: año filtra variantes y detalle completa especificaciones',async()=>{
 const variants=await query('generations?model_id=md-duster&year=2022');assert.equal(variants.items[0].value,'vr-duster-2022');
 const detail=await query('engines?generation_id=vr-duster-2022');assert.equal(detail.items[0].fuel,'Petrol');assert.equal(detail.items[0].displacement,1332);assert.equal(detail.items[0].transmission,'Cvt');
});

test('V04 corregida: proveedor caído activa catálogo local en frontend',async()=>{
 const offline=createCatalogService({mode:()=>true,base:()=>'',fetcher:async()=>{throw Error('offline');}});const r=await offline.query('makes');assert.equal(r.source,'local');assert.ok(r.fallback);assert.ok(r.items.length);
});

test('V04 corregida: IDs externos se conservan y no se validan contra tablas masivas D1',async()=>{
 const v=normalizeVehicle({plate:'VCA404',make:'Renault',model:'Duster',year:2022,ownerId:'c1',catalog_make_id:'mk-renault',catalog_model_id:'md-duster',catalog_generation_id:'vr-duster-2022'});
 const dbThatMustNotBeUsed={prepare(){throw Error('D1 NO DEBE CONSULTARSE PARA CATÁLOGO');}};await validateCatalogVehicle(dbThatMustNotBeUsed,v);assert.equal(v.catalog_model_id,'md-duster');
});

test('V04 corregida: registro manual no depende del proveedor',async()=>{const v=normalizeVehicle({plate:'MAN404',make:'Artesanal',model:'Único',year:2020,ownerId:'c1'});await validateCatalogVehicle({prepare(){throw Error('no');}},v);assert.equal(v.make,'Artesanal');});

test('V04 corregida: cambiar marca limpia descendientes e IDs',()=>{const s={make:'Renault',model:'Duster',year:'2022',generation:'X',catalog_make_id:'a',catalog_model_id:'b',catalog_generation_id:'c'};const n=changeCatalogSelection(s,'make','Toyota');assert.equal(n.model,'');assert.equal(n.catalog_model_id,'');});
