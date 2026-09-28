import {store,uid} from '../services/store.js';
import {mountCatalogPicker} from '../components/catalogPicker.js';
import {vehicleLookupService} from '../services/vehicleLookupService.js';
import {normalizePlate,validPlate,findVehicleByPlate} from '../services/vehicleIdentity.js';
import {esc,modal,closeModal,field,selectField,options,button,formFooter,toast} from '../components/ui.js';
import {findReferenceImage} from '../services/vehicleImageService.js';
let draft=null,requestVersion=0,disposePicker=null;
const specsKeys=['bodyType','engine','displacement','fuel','transmission','drive'];
const specLabels={bodyType:'Carrocería',engine:'Motor',displacement:'Cilindraje',fuel:'Combustible',transmission:'Transmisión',drive:'Tracción'};
function collect(){const form=document.getElementById('vehicle-form');if(!form||!draft)return;for(const [k,v] of new FormData(form))draft.values[k]=v;}
function modelFields(){if(draft.mode==='manual')return `<div class="form-grid">${field('Tipo de vehículo','type',draft.values.type||'Automóvil')}${field('Marca','make',draft.values.make,'text','required')}${field('Año','year',draft.values.year,'number','required min="1900" max="2100"')}${field('Línea / modelo','model',draft.values.model,'text','required')}${field('Versión','version',draft.values.version)}</div>`;
return '<div class="catalog-loading">Cargando catálogo…</div>';}
function paint(){disposePicker?.();const v=draft.values;modal(draft.id?'Editar vehículo':'Registrar vehículo',`<form id="vehicle-form" data-id="${draft.id||''}"><div class="form-section-head"><div><span class="eyebrow">DATOS DEL MODELO</span><h3>Encuentra la versión correcta</h3></div><div class="row-actions">${button('Usar catálogo','vf-catalog',draft.mode==='catalog'?'primary':'secondary')}${button('Catálogo local','vf-local','secondary')}${button('No encuentro mi vehículo','vf-manual',draft.mode==='manual'?'primary':'secondary')}</div></div>${v.recognitionSource?'<p class="callout">Datos de reconocimiento precargados. Confirma placa, marca y modelo antes de guardar.</p>':''}<div id="model-fields">${modelFields()}</div><div class="form-grid section-gap" id="spec-fields">${specsKeys.map(k=>field(specLabels[k],k,v[k]||'','text','maxlength="100"')).join('')}</div><p class="hint">Especificaciones editables. Los campos vacíos no se conocen; no se inventan valores técnicos.</p><div class="form-section-head section-gap"><div><span class="eyebrow">DATOS DEL VEHÍCULO</span><h3>Su identidad en tu taller</h3></div></div><div class="form-grid">${field('Placa','plate',v.plate,'text','required maxlength="12" placeholder="ABC 123" autocapitalize="characters"')}${selectField('Propietario','ownerId',`<option value="">Selecciona propietario</option>${options(store.data.clients,v.ownerId||v.customer_id)}`,'required')}<div class="quick-owner-action"><span>¿El cliente aún no existe?</span>${button('Crear cliente nuevo','vf-new-client','small-btn')}</div>${field('VIN / chasis','vin',v.vin)}${field('Color real','color',v.color)}${field('Kilometraje','mileage',v.mileage??0,'number','required min="0" max="9999999"')}</div><div class="manual-fallback"><span>¿No encuentras tu vehículo?</span>${button('Registrar manualmente','vf-manual','small-btn')}</div><details class="optional-lookup"><summary>Consulta vehicular externa (opcional)</summary><p class="hint">Solo si tu taller tiene un proveedor autorizado configurado.</p>${field('Documento del propietario (si lo exige el proveedor)','lookupDocument','','text','maxlength="40"')}<label class="consent-line"><input type="checkbox" id="lookup-consent"> Autorizo enviar placa y documento al proveedor de consulta configurado.</label>${button('Consultar datos automáticamente','vf-lookup','secondary')}<p id="lookup-message" class="hint" role="status"></p></details>${formFooter()}</form>`,{wide:true});if(draft.mode==='catalog')disposePicker=mountCatalogPicker(document.getElementById('model-fields'),draft.values,{onChange:v=>{for(const key of specsKeys){const input=document.querySelector(`#vehicle-form [name="${key}"]`);if(input)input.value=v[key]||'';}}});}
export async function openVehicleForm(id,prefill={},manual=false){
 const old=store.get('vehicles',id);draft={id,mode:old||manual||prefill.make||prefill.brand?'manual':'catalog',values:{type:'Automóvil',...old,...(!old?prefill:{}),make:old?.make||old?.brand||prefill.make||prefill.brand||'',ownerId:old?.ownerId||prefill.ownerId||'',versionId:''},choices:{},notice:'Cargando catálogo…'};paint();

}
export async function catalogChanged(){} // Picker handles its own dependent controls.
export async function vehicleFormAction(action){if(action==='vf-new-client'){collect();modal('Nuevo cliente · recepción rápida',`<form id="quick-client-form" class="form-grid">${field('Nombre completo','name','','text','required maxlength="100"')}${field('Documento','document','','text','required maxlength="30"')}${field('Teléfono','phone','','tel','required pattern="[0-9 +()-]{7,20}"')}${field('Correo electrónico','email','','email','required')}${field('Notas','notes','Creado desde recepción')}${formFooter('Crear cliente y continuar')}</form>`);return;}
 if(action==='vf-manual'){collect();requestVersion++;draft.mode='manual';for(const key of ['catalog_make_id','catalog_model_id','catalog_generation_id','catalog_engine_id'])draft.values[key]='';paint();return;}
 if(action==='vf-catalog'||action==='vf-local'){collect();draft.values.catalogSource=action==='vf-local'?'local':'auto';requestVersion++;draft.mode='catalog';draft.notice='Cargando catálogo…';for(const key of ['make','model','year','generation','version','catalog_make_id','catalog_model_id','catalog_generation_id','catalog_engine_id'])draft.values[key]='';paint();return;}
 if(action==='vf-lookup'){collect();const form=document.getElementById('vehicle-form'),output=document.getElementById('lookup-message');output.textContent='Consultando…';try{const result=await vehicleLookupService.lookup({plate:draft.values.plate,ownerDocument:form.elements.lookupDocument.value,consent:document.getElementById('lookup-consent').checked});if(!form.isConnected)return;output.textContent=result.notice||'Datos consultados. Revisa y confirma.';if(result.source==='Consulta externa'){for(const k of ['make','model','year','version','vin',...specsKeys,'color'])if(result[k])draft.values[k]=result[k];draft.mode='manual';paint();document.getElementById('lookup-message').textContent='Datos consultados. Revisa y confirma.';}}catch(e){output.textContent=e.message;}}
}
export async function saveVehicleForm(form){collect();const v=draft.values;v.plate=normalizePlate(v.plate);if(!validPlate(v.plate))throw new Error('Placa inválida. Usa ABC123 (automóvil) o ABC12D (moto).');const existing=findVehicleByPlate(store.data.vehicles,v.plate);if(existing&&existing.id!==draft.id)throw new Error('Esta placa ya está registrada. Abre su ficha desde la búsqueda.');
 if(!v.make?.trim()||!v.model?.trim()||!v.year)throw new Error('Completa marca, año y modelo; puedes usar el registro manual.');
 if(draft.mode==='catalog'&&v.catalogSource!=='local'&&(!v.catalog_make_id||!v.catalog_model_id))throw new Error('Selecciona una marca y modelo de la lista o usa el registro manual.');
 if(draft.mode==='manual')for(const k of ['catalog_make_id','catalog_model_id','catalog_generation_id','catalog_engine_id'])v[k]='';
 const {lookupDocument,versionId,specs,...values}=v;
 let saved=await store.put('vehicles',{...values,id:draft.id||undefined,vehicle_id:draft.id||undefined,make:v.make,brand:v.make,customer_id:v.ownerId,year:Number(v.year),mileage:Number(v.mileage),updated_at:new Date().toISOString()});
 disposePicker?.();closeModal();location.hash=`/vehicles/${saved.id}`;toast('Vehículo guardado. Buscando una imagen de referencia…');
 if(!(saved.referenceImage?.imageUrl||saved.referenceImage?.thumbnail)){const result=await findReferenceImage(saved);if(result?.found&&result.best){saved=await store.put('vehicles',{...saved,referenceImage:{...result.best,provider:result.provider,notice:result.notice,selectedAt:new Date().toISOString()}});location.hash=`/vehicles/${saved.id}?tab=history`;toast('Imagen de referencia encontrada.');}else toast('Vehículo guardado. No encontramos una imagen abierta adecuada; conservamos la ilustración.');}
 return saved;
}

export async function saveQuickClient(form){
 const v=Object.fromEntries(new FormData(form));
 if(store.data.clients.some(c=>String(c.document).trim()===String(v.document).trim()))throw new Error('Ya existe un cliente con este documento.');
 const saved=await store.put('clients',{id:uid('client'),...v,active:true});
 await store.log(`Cliente ${v.name} creado desde recepción`);
 draft.values.ownerId=saved.id;
 toast('Cliente creado y asignado al vehículo.');
 paint();
 return saved;
}
