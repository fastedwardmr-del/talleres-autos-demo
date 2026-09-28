import {localCatalogQuery} from '../data/vehicleCatalog.js';
import {runtime} from '../runtime-config.js';
import {catalogSearch} from './catalogNormalization.js';
export const catalogLevels=['type','make','model','year','generation','versionId'];
export function changeCatalogSelection(selection,level,value){
 const next={...selection,[level]:value};
 for(const key of catalogLevels.slice(catalogLevels.indexOf(level)+1))next[key]='';
 const ids={make:'catalog_make_id',model:'catalog_model_id',generation:'catalog_generation_id',versionId:'catalog_engine_id'};
 for(const key of catalogLevels.slice(catalogLevels.indexOf(level)))if(ids[key])next[ids[key]]='';
 next.version='';next.specs=null;return next;
}
export function createCatalogService({fetcher=globalThis.fetch,mode=()=>runtime.dataMode==='api',base=()=>runtime.apiBase}={}){return {
 async query(level,s={},q='',offset=0){
  const local=()=>{
   // Fallback local: nunca mezcla IDs externos con las opciones locales.
   let items=['generations','engines'].includes(level)?[]:localCatalogQuery(level,{...s,type:undefined});
   if(Array.isArray(items))items=items.filter(x=>catalogSearch(x.label).includes(catalogSearch(q)));
   const paged=Array.isArray(items)&&level!=='years';return {items:paged?items.slice(offset,offset+30):items,hasMore:paged&&items.length>offset+30,nextOffset:offset+30,source:'local',notice:'Catálogo local de emergencia, orientativo. Si falta tu vehículo, registra manualmente.'};
  };
  if(level==='types'||s.catalogSource==='local'||['versions','specs'].includes(level))return local();
  const params=new URLSearchParams({q,offset:String(offset)});
  if(s.catalog_make_id)params.set('make_id',s.catalog_make_id);
  if(s.catalog_model_id)params.set('model_id',s.catalog_model_id);
  if(s.catalog_generation_id)params.set('generation_id',s.catalog_generation_id);
  if(s.year)params.set('year',s.year);
  try{
   const response=await fetcher(base()+'/api/catalog/'+level+'?'+params,{signal:AbortSignal.timeout(8000)});
   const result=await response.json();if(!response.ok||!result.ok)throw new Error('Catálogo no disponible');
   // Empty is a valid result: do not mix remote IDs with unrelated fallback choices.
   return result.data;
  }catch{return {...local(),fallback:true};}
 }
};}
export const vehicleCatalogService=createCatalogService();
