import {vehicleCatalogService,changeCatalogSelection} from '../services/vehicleCatalogService.js';
import {esc,field,selectField} from './ui.js';
const labels={make:'Marca',model:'Modelo / línea',generation:'Generación',versionId:'Motor / versión'};
const routes={make:'makes',model:'models',generation:'generations',versionId:'engines'};
const ids={make:'catalog_make_id',model:'catalog_model_id',generation:'catalog_generation_id',versionId:'catalog_engine_id'};
const types=['Automóvil','SUV','Camioneta','Comercial','Motocicleta','Otro'];
export const catalogAttribution=()=>'';
export function mountCatalogPicker(root,values,{onChange=()=>{},service=vehicleCatalogService}={}){
 let epoch=0,timer,disposed=false,years=[],showGeneration=false,showEngine=false;
 const pending=new Map();
 const active=()=>!disposed&&root.isConnected;
 const ready=k=>k==='make'||k==='model'&&!!values.make||k==='generation'&&!!values.year||k==='versionId'&&!!values.catalog_generation_id;
 const text=k=>k==='versionId'?values.version||'':values[k]||'';
 function combo(k){return `<div class="field catalog-combo"><label for="catalog-${k}">${labels[k]}</label><input id="catalog-${k}" data-picker="${k}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="options-${k}" autocomplete="off" placeholder="Buscar o seleccionar…" value="${esc(text(k))}" ${ready(k)?'':'disabled'}><div class="catalog-options" id="options-${k}" role="listbox" aria-label="${labels[k]}" hidden></div></div>`;}
 function render(){if(!active())return;root.innerHTML=`<div class="form-grid">${selectField('Tipo de vehículo','type',types.map(t=>`<option ${values.type===t?'selected':''}>${t}</option>`).join(''))}${combo('make')}${combo('model')}${selectField('Año','year','<option value="">Seleccionar…</option>'+years.map(y=>`<option value="${y.value}" ${String(values.year)===y.value?'selected':''}>${y.label}</option>`).join(''),`${years.length?'':'disabled'} data-picker-year`)}${showGeneration?combo('generation'):''}${showEngine?combo('versionId'):''}</div><p class="hint" role="status" id="catalog-notice">${values.catalogSource==='local'?'Catálogo local de emergencia.':'Catálogo vehicular en línea.'} Si no encuentras tu vehículo, usa «No encuentro mi vehículo».</p>${catalogAttribution()}`;}
 function invalidate(k){epoch++;pending.clear();Object.assign(values,changeCatalogSelection(values,k,''));for(const f of ['engine','displacement','fuel','transmission','drive','bodyType'])values[f]='';if(['make','model'].includes(k))years=[];if(['make','model','year'].includes(k))showGeneration=false;if(k!=='versionId')showEngine=false;onChange(values);}
 async function choose(k,item,source){
  invalidate(k);values.catalogSource=source;values[k]=item.label;values[ids[k]]=source==='local'?'':item.value;
  if(k==='versionId'){values.version=item.label;values.engine=item.label;for(const f of ['displacement','fuel','transmission','drive'])values[f]=item[f]??'';values.specificationSource=source;}
  onChange(values);render();const token=epoch;
  if(k==='model'){
   const result=await service.query('years',values);if(!active()||token!==epoch)return;if(fallback(result))return;years=result.items||[];render();
   if(!years.length)notice('No hay años documentados para este modelo. Puedes registrarlo manualmente.');
  }else if(k==='generation'){
   const result=await service.query('engines',values);if(!active()||token!==epoch)return;if(fallback(result))return;showEngine=!!result.items?.length;render();
  }
 }
 function fallback(result){if(!result.fallback||values.catalogSource==='local')return false;invalidate('make');values.catalogSource='local';render();notice('Catálogo en línea no disponible. Selecciona marca y modelo en el catálogo local o registra manualmente.');return true;}
 function notice(message){const n=root.querySelector('#catalog-notice');if(n)n.textContent=message;}
 async function search(k,q='',offset=0){
  const input=root.querySelector(`[data-picker="${k}"]`),list=root.querySelector('#options-'+k);if(!input||input.disabled)return;
  const token=Symbol();pending.set(k,token);list.hidden=false;list.innerHTML='<div role="status">Buscando…</div>';input.setAttribute('aria-expanded','true');
  const result=await service.query(routes[k],values,q,offset);if(!active()||pending.get(k)!==token||!input.isConnected)return;
  notice(result.notice);list.innerHTML='';
  if(result.fallback&&values.catalogSource!=='local'){
   // Switch the whole chain, rather than retaining D1 ancestors alongside local children.
   invalidate('make');values.catalogSource='local';render();notice('Catálogo en línea no disponible. Activamos el catálogo local; vuelve a seleccionar marca y modelo o registra manualmente.');return;
  }
  for(const [i,item] of (result.items||[]).entries()){
   const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.id=`choice-${k}-${i}`;b.textContent=item.label;b.addEventListener('click',()=>choose(k,item,result.source));list.append(b);
  }
  if(!result.items?.length)list.innerHTML='<div role="status">Sin resultados. Usa «No encuentro mi vehículo».</div>';
  if(result.hasMore){const more=document.createElement('button');more.type='button';more.textContent='Ver más resultados';more.addEventListener('click',()=>search(k,q,result.nextOffset));list.append(more);}
 }
 const focusIn=e=>{const k=e.target.dataset.picker;if(k&&root.querySelector('#options-'+k)?.hidden)search(k,'');};root.addEventListener('focus',focusIn,true);root.addEventListener('click',focusIn);
 root.oninput=e=>{const k=e.target.dataset.picker;if(!k)return;const q=e.target.value;invalidate(k);for(const downstream of ['model','generation','versionId'])if(downstream!==k&&!values[downstream]){const el=root.querySelector(`[data-picker="${downstream}"]`);if(el){el.value='';el.disabled=!ready(downstream);}}const year=root.querySelector('[data-picker-year]');if(['make','model'].includes(k)&&year){year.value='';year.disabled=true;}clearTimeout(timer);timer=setTimeout(()=>search(k,q),250);};
 root.onchange=async e=>{if(e.target.name==='type'){values.type=e.target.value;return;}if(!e.target.hasAttribute('data-picker-year'))return;const year=e.target.value;invalidate('year');values.year=year;render();if(!year)return;const token=epoch;const r=await service.query('generations',values);if(active()&&token===epoch){if(fallback(r))return;showGeneration=!!r.items?.length;render();}};
 root.onkeydown=e=>{const k=e.target.dataset.picker;const list=k?root.querySelector('#options-'+k):e.target.closest('.catalog-options');if(!list)return;const options=[...list.querySelectorAll('button')];if(e.key==='Escape'){list.hidden=true;root.querySelector(`[aria-controls="${list.id}"]`)?.setAttribute('aria-expanded','false');}if(['ArrowDown','ArrowUp'].includes(e.key)&&options.length){e.preventDefault();const index=options.indexOf(document.activeElement);options[(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length].focus();}if(k&&e.key==='Enter'&&!list.hidden){e.preventDefault();options[0]?.click();}};
 const focusOut=e=>{if(e.relatedTarget&&!root.contains(e.relatedTarget))for(const list of root.querySelectorAll('.catalog-options'))list.hidden=true;};
 root.addEventListener('focusout',focusOut);render();return ()=>{disposed=true;epoch++;clearTimeout(timer);root.removeEventListener('focus',focusIn,true);root.removeEventListener('click',focusIn);root.removeEventListener('focusout',focusOut);root.oninput=root.onchange=root.onkeydown=null;};
}
