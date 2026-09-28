import {fail} from './validation.js';

const BASE='https://fleetcatalog.disturbingbyte.pt/v1';
const NOTICE='Catálogo gratuito FleetByte · consulta bajo demanda · 0 escrituras D1. Confirma los datos; si no aparece tu vehículo, usa el registro manual.';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const clean=v=>String(v??'').trim();
const yearNumber=v=>{const m=clean(v).match(/(?:19|20)\d{2}/);return m?Number(m[0]):null;};
function range(item){
 const direct=yearNumber(item.year??item.modelYear);
 const start=yearNumber(item.yearStart??item.startYear??item.yearFrom??item.productionStartYear??item.productionStart??item.fromYear??item.firstYear);
 const end=yearNumber(item.yearEnd??item.endYear??item.yearTo??item.productionEndYear??item.productionEnd??item.toYear??item.lastYear);
 if(direct)return [direct,direct];
 if(start)return [start,end||Math.min(new Date().getFullYear()+1,2100)];
 return null;
}
function yearsFrom(items){
 const set=new Set();for(const item of items){const r=range(item);if(!r)continue;for(let y=clamp(r[0],1886,2100);y<=clamp(r[1],1886,2100);y++)set.add(y);}
 return [...set].sort((a,b)=>b-a).map(year=>({value:String(year),label:String(year)}));
}
function providerItem(item){return {id:clean(item.id),value:clean(item.id),label:clean(item.name??item.label??item.title??item.variantName??item.modelName),...item};}
async function provider(path,fetcher=fetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
 try{
  const res=await fetcher(BASE+path,{headers:{Accept:'application/json'},signal:controller.signal,cf:{cacheTtl:86400,cacheEverything:true}});
  if(!res.ok){const e=new Error('Proveedor de catálogo no disponible');e.status=res.status===429?429:502;throw e;}
  return await res.json();
 }finally{clearTimeout(timer);}
}
const pageData=data=>({items:Array.isArray(data)?data:(data?.items||[]),total:Number(data?.total||0),page:Number(data?.page||1),pageSize:Number(data?.pageSize||30)});
export async function queryCatalog(_db,url,fetcher=fetch){
 const level=url.pathname.split('/').at(-1),p=url.searchParams,q=clean(p.get('q')).slice(0,100),offset=Number(p.get('offset')||0);
 if(!Number.isInteger(offset)||offset<0||offset>100000)fail('Página inválida.');
 const makeId=clean(p.get('make_id')),modelId=clean(p.get('model_id')),variantId=clean(p.get('generation_id'));
 const need=(v,msg)=>{if(!v||v.length>100)fail(msg);return encodeURIComponent(v);};
 const page=Math.floor(offset/30)+1,search=q?'&search='+encodeURIComponent(q):'';
 try{
  if(level==='makes'){
   const d=pageData(await provider(`/makes?page=${page}&pageSize=30${search}`,fetcher)),items=d.items.map(providerItem).filter(x=>x.value&&x.label);
   return {items,hasMore:offset+items.length<d.total,nextOffset:offset+30,source:'fleetbyte',notice:NOTICE};
  }
  if(level==='models'){
   const d=pageData(await provider(`/makes/${need(makeId,'Selecciona primero una marca válida.')}/models?page=${page}&pageSize=30${search}`,fetcher)),items=d.items.map(providerItem).filter(x=>x.value&&x.label);
   return {items,hasMore:offset+items.length<d.total,nextOffset:offset+30,source:'fleetbyte',notice:NOTICE};
  }
  if(level==='years'){
   need(makeId,'Selecciona primero una marca válida.');need(modelId,'Selecciona primero un modelo válido.');
   let candidates=[];
   try{const model=await provider(`/makes/${encodeURIComponent(makeId)}/models/${encodeURIComponent(modelId)}`,fetcher);candidates=[model];}catch{}
   let years=yearsFrom(candidates);
   if(!years.length){const d=pageData(await provider(`/models/${encodeURIComponent(modelId)}/variants?page=1&pageSize=100`,fetcher));years=yearsFrom(d.items);}
   return {items:years,hasMore:false,nextOffset:0,source:'fleetbyte',notice:years.length?NOTICE:'La fuente no publica años para este modelo. Usa «No encuentro mi vehículo» para registrarlo manualmente.'};
  }
  if(level==='generations'){
   const year=Number(p.get('year'));if(!Number.isInteger(year)||year<1886||year>2100)fail('Selecciona un año válido.');
   const d=pageData(await provider(`/models/${need(modelId,'Selecciona primero un modelo válido.')}/variants?year=${year}&page=${page}&pageSize=30${search}`,fetcher));
   const items=d.items.map(providerItem).filter(x=>x.value&&x.label);
   return {items,hasMore:offset+items.length<d.total,nextOffset:offset+30,source:'fleetbyte',notice:NOTICE};
  }
  if(level==='engines'){
   const raw=await provider(`/variants/${need(variantId,'Selecciona primero una variante válida.')}`,fetcher),x=providerItem(raw);
   const item={...x,value:x.value,label:x.label||'Versión seleccionada',fuel:x.fuelType??x.fuel??'',displacement:x.displacementCc??x.engineDisplacementCc??x.displacement??'',transmission:x.gearboxType??x.transmission??'',drive:x.driveType??x.drive??'',bodyType:x.bodyType??''};
   return {items:item.value?[item]:[],hasMore:false,nextOffset:0,source:'fleetbyte',notice:NOTICE};
  }
  if(level==='meta')return {source:{provider:'FleetByte Catalog API',base:BASE,authentication:'none'},notice:NOTICE};
  fail('Consulta de catálogo no disponible.','NOT_FOUND',404);
 }catch(e){if(e.code)throw e;const status=e.status===429?429:503;fail(e.status===429?'El catálogo gratuito alcanzó temporalmente su límite de consultas. Usa el registro manual.':'El catálogo gratuito no está disponible en este momento. Usa el registro manual.','CATALOG_PROVIDER',status);}
}

// Los IDs del catálogo son referencias externas orientativas. El vehículo guarda un snapshot
// textual (marca/modelo/año/versión), por lo que guardar un vehículo nunca depende del proveedor
// ni requiere leer/escribir las antiguas tablas masivas del catálogo en D1.
export async function validateCatalogVehicle(_db,v,previous){
 const fields=['catalog_make_id','catalog_model_id','catalog_generation_id','catalog_engine_id','make','model','year','generation','version'];
 if(previous&&fields.every(k=>v[k]===previous[k]))return;
 if(!v.catalog_make_id&&!v.catalog_model_id&&!v.catalog_generation_id&&!v.catalog_engine_id)return;
 if(!clean(v.make)||!clean(v.model)||!Number.isInteger(Number(v.year)))fail('Marca, modelo y año son obligatorios. Usa el registro manual si es necesario.');
 for(const key of ['catalog_make_id','catalog_model_id','catalog_generation_id','catalog_engine_id'])if(v[key]&&clean(v[key]).length>100)fail('Referencia de catálogo inválida.');
}
