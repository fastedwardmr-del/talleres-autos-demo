import * as intelligent from './modules/identification.js';
import {catalogChanged,vehicleFormAction,saveQuickClient} from './modules/vehicleForm.js';
import {plateMatches} from './services/vehicleIdentity.js';
import {config} from './config.js';
import {store,uid} from './services/store.js';
import {day} from './data/seed.js';
import {notificationsAdapter} from './services/adapters.js';
import * as ui from './components/ui.js';
import {dashboard} from './modules/dashboard.js';
import * as entities from './modules/entities.js';
import * as reception from './modules/reception.js';
import * as orders from './modules/orders.js';
import * as commerce from './modules/commerce.js';
import * as operations from './modules/operations.js';
import * as superadmin from './modules/superadmin.js';
const {esc,icon,modal,closeModal,toast,button,field,selectField,formFooter,empty}=ui;
const navigation=[['home','Inicio'],['clients','Clientes'],['vehicles','Vehículos'],['reception','Recepción'],['orders','Órdenes de trabajo'],['quotes','Cotizaciones'],['agenda','Agenda'],['inventory','Inventario'],['pos','POS / Ventas'],['cash','Caja'],['technicians','Técnicos'],['reports','Reportes'],['settings','Configuración'],['superadmin','Super Admin']];
let collapsed=localStorage.getItem('tallerpro.sidebar')==='true';
export function route(){const [path,query='']=(location.hash.slice(1)||'/home').split('?');const [page='home',id]=path.replace(/^\//,'').split('/');return {page,id,params:new URLSearchParams(query)};}
function shell(){document.documentElement.style.setProperty('--accent',config.accent);document.getElementById('app').innerHTML=`<aside class="sidebar" id="sidebar"><a class="brand" href="#/home"><span class="brand-mark">T<span>˙</span></span><div><b id="brand-name">${esc(store.data.settings.name||config.name)}</b><small>${config.tagline}</small></div></a><button class="workspace" data-action="workshop-info"><span class="workshop-icon">${icon('tool')}</span><div><b>${esc(store.data.settings.workshop)}</b><small><i class="live-dot"></i> Taller principal</small></div><span>⌄</span></button><div class="nav-label">PRINCIPAL</div><nav>${navigation.map(([key,label],i)=>`${i===7?'<div class="nav-label nav-separator">ADMINISTRACIÓN</div>':''}${i===12?'<div class="nav-separator"></div>':''}<a href="#/${key}" data-nav="${key}" title="${label}">${icon(key)}<span>${label}</span>${key==='orders'?'<b class="nav-count">'+store.data.orders.filter(o=>!['ENTREGADO','CANCELADO'].includes(o.status)).length+'</b>':''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="demo-note"><i class="live-dot"></i><span>Modo demostración<small>${store.mode==='api'?'Datos compartidos · Cloudflare':'Datos locales · Integraciones opcionales'}</small></span></div><button class="collapse-button" data-action="toggle-sidebar" aria-label="Contraer o expandir menú">${icon('menu')}<span>Contraer menú</span></button><div class="profile"><span class="avatar">ED</span><div><b>Edward</b><small>Administrador demo</small></div><span class="profile-dot"></span></div></div></aside><div class="sidebar-backdrop" data-action="close-sidebar"></div><div class="workspace-main"><header class="topbar"><div class="topbar-left"><button class="icon-btn menu-toggle" data-action="toggle-sidebar" aria-label="Abrir menú">${icon('menu')}</button><span class="breadcrumb">Taller principal <span>/</span> <b id="breadcrumb">Inicio</b></span></div><div class="global-search"><div class="search-box">${icon('search')}<input id="global-search" placeholder="Buscar cliente, vehículo, placa, orden…" aria-label="Búsqueda global" autocomplete="off"><kbd>⌘ K</kbd></div><div id="global-results" class="search-results" hidden></div></div><span class="demo-chip">DEMO</span><button class="icon-btn notification-button" data-action="notifications" aria-label="Ver alertas">${icon('bell')}<i></i></button><span class="avatar top-avatar">ED</span></header><main id="main" tabindex="-1"></main><footer class="app-footer"><span>${esc(store.data.settings.name)} <span class="muted">/ Hecho para que tu taller avance.</span></span><span><i class="live-dot"></i> ${store.mode==='api'?'<span class="cloud-status" id="cloud-status">Conectado · D1 + R2 · V0.4 <button class="text-link" data-action="cloud-refresh">Actualizar datos</button></span>':'Guardado en este dispositivo · V0.4 · Modo local'}</span></footer></div>`;document.body.classList.toggle('sidebar-collapsed',collapsed);}
export function render(){const {page,id,params}=route();let html;switch(page){case 'home':html=dashboard();break;case 'clients':html=id?entities.clientDetail(id):entities.clientsView();break;case 'vehicles':html=id?entities.vehicleDetail(id,params.get('tab')||'history'):entities.vehiclesView();break;case 'reception':html=reception.receptionView(id);break;case 'orders':html=id?orders.orderDetail(id,params.get('tab')||'work'):orders.ordersView(params.get('status'));break;case 'quotes':html=id?commerce.quoteDetail(id):commerce.quotesView();break;case 'inventory':html=entities.inventoryView();break;case 'pos':html=commerce.posView();break;case 'cash':html=commerce.cashView();break;case 'agenda':html=operations.agendaView();break;case 'technicians':html=operations.techniciansView();break;case 'reports':html=operations.reportsView();break;case 'settings':html=operations.settingsView();break;case 'superadmin':html=superadmin.superadminView();break;default:html=empty('Página no encontrada','Usa el menú para volver al taller.');}document.getElementById('main').innerHTML=html;if(page==='settings')intelligent.loadIntegrationPanel();document.getElementById('breadcrumb').textContent=navigation.find(n=>n[0]===page)?.[1]||'Inicio';document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===page);if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.title=`${navigation.find(n=>n[0]===page)?.[1]||'Taller'} · ${store.data.settings.name}`;const count=document.querySelector('.nav-count');if(count)count.textContent=store.data.orders.filter(o=>!['ENTREGADO','CANCELADO'].includes(o.status)).length;}
function refreshList(){const {page}=route(),q=document.getElementById('list-search')?.value||'',filter=document.getElementById('list-filter')?.value||'';const fn={clients:entities.clientRows,vehicles:entities.vehicleRows,inventory:entities.productRows,orders:orders.orderRows,quotes:commerce.quoteRows}[page];if(fn)document.getElementById('list-results').innerHTML=fn(q,filter);}
function refreshCart(){document.getElementById('cart-items').innerHTML=commerce.cartView();document.getElementById('cart-total').innerHTML=commerce.cartTotal();}
function confirm(title,text,action,attrs=''){modal(title,`<p>${text}</p><div class="form-footer">${button('Cancelar','close-modal','secondary')}${button('Confirmar',action,'primary',attrs)}</div>`);}
function globalSearch(q){const root=document.getElementById('global-results');q=q.toLowerCase().trim();if(!q){root.hidden=true;return;}const matches=[...store.data.vehicles.filter(v=>`${v.plate} ${v.brand} ${v.model}`.toLowerCase().includes(q)||plateMatches(v.plate,q)).map(v=>({name:`${v.plate} · ${v.brand} ${v.model}`,sub:ui.client(v.ownerId)?.name,href:`vehicles/${v.id}`})),...store.data.clients.filter(c=>`${c.name} ${c.document}`.toLowerCase().includes(q)).map(c=>({name:c.name,sub:'Cliente · '+c.phone,href:`clients/${c.id}`})),...store.data.orders.filter(o=>o.number.toLowerCase().includes(q)).map(o=>({name:o.number,sub:ui.vehicleName(o.vehicleId),href:`orders/${o.id}`}))].slice(0,8);root.innerHTML=matches.map(m=>`<a href="#/${m.href}"><b>${esc(m.name)}</b><small>${esc(m.sub)}</small>${icon('arrow')}</a>`).join('')||'<p>No encontramos resultados.</p>';root.hidden=false;}
document.addEventListener('input',event=>{if(event.target?.id==='superadmin-search')superadmin.filterRows(event.target.value);});
document.addEventListener('click',async event=>{const target=event.target.closest('[data-action]');try{
 if(event.target.closest('#global-results a')){document.getElementById('global-results').hidden=true;document.getElementById('global-search').value='';}
 if(!event.target.closest('.global-search')&&document.getElementById('global-results'))document.getElementById('global-results').hidden=true;
 if(event.target.closest('#damage-map')){reception.markDamage(event,event.target.closest('#damage-map'));render();return;}
 if(!target)return;const {action,id,index,kind}=target.dataset;
 if(action.startsWith('smart-')||action.startsWith('qr-')){await intelligent.identificationAction(action,target);return;}
 if(action.startsWith('vf-')){await vehicleFormAction(action);return;}
 switch(action){
 case 'cloud-refresh':await store.refresh();render();toast('Datos actualizados desde el servidor');break;
 case 'cloud-retry-save':await store.retry();render();toast('Operación confirmada');break;
 case 'close-modal':closeModal();break;
 case 'toggle-sidebar':if(innerWidth<=1000)document.body.classList.toggle('sidebar-open');else{collapsed=!collapsed;document.body.classList.toggle('sidebar-collapsed',collapsed);localStorage.setItem('tallerpro.sidebar',collapsed);}break;
 case 'close-sidebar':document.body.classList.remove('sidebar-open');break;
 case 'workshop-info':location.hash='/settings';break;
 case 'notifications':modal('Alertas del taller',store.data.products.filter(p=>p.stock<=p.minStock).map(p=>`<a class="simple-row" href="#/inventory" data-action="close-modal"><b>${esc(p.name)}</b><span class="orange-text">${p.stock} disponibles · mínimo ${p.minStock}</span></a>`).join('')+store.data.vehicles.flatMap(v=>v.reminders.filter(r=>r.status!=='COMPLETADO'&&r.date<day()).map(r=>`<a class="simple-row" href="#/vehicles/${v.id}?tab=reminders" data-action="close-modal"><b>${v.plate} · ${esc(r.title)}</b>${ui.badge('VENCIDO')}</a>`)).join(''));break;
 case 'set-vehicle-cover':await entities.setVehicleCover(id,target.dataset.file);toast('Portada actualizada');break;
 case 'new-client':entities.editClient();break;
 case 'admin-delete-order':confirm('Eliminar orden','Se eliminará esta orden y las cotizaciones vinculadas. Esta acción no se puede deshacer.','confirm-admin-delete-order',`data-id="${id}"`);break;
 case 'confirm-admin-delete-order':await superadmin.deleteOrder(id);closeModal();render();toast('Orden eliminada');break;
 case 'admin-delete-quote':confirm('Eliminar cotización','Esta cotización se eliminará permanentemente.','confirm-admin-delete-quote',`data-id="${id}"`);break;
 case 'confirm-admin-delete-quote':await superadmin.deleteQuote(id);closeModal();render();toast('Cotización eliminada');break;
 case 'admin-delete-vehicle':confirm('Eliminar vehículo','Se eliminarán también sus órdenes, cotizaciones y citas relacionadas.','confirm-admin-delete-vehicle',`data-id="${id}"`);break;
 case 'confirm-admin-delete-vehicle':await superadmin.deleteVehicle(id);closeModal();render();toast('Vehículo y registros relacionados eliminados');break;
 case 'admin-delete-client':confirm('Eliminar cliente','Se eliminarán también sus vehículos y registros operativos relacionados.','confirm-admin-delete-client',`data-id="${id}"`);break;
 case 'confirm-admin-delete-client':await superadmin.deleteClient(id);closeModal();render();toast('Cliente y registros relacionados eliminados');break;
 case 'admin-delete-sale':confirm('Eliminar venta y revertir inventario','La venta se eliminará y los repuestos de esa venta volverán al inventario. Esta acción no se puede deshacer.','confirm-admin-delete-sale',`data-id="${id}"`);break;
 case 'confirm-admin-delete-sale':await superadmin.deleteSale(id);closeModal();render();toast('Venta eliminada e inventario revertido');break;
 case 'admin-delete-appointment':confirm('Eliminar cita','La cita se eliminará permanentemente.','confirm-admin-delete-appointment',`data-id="${id}"`);break;
 case 'confirm-admin-delete-appointment':await superadmin.deleteAppointment(id);closeModal();render();toast('Cita eliminada');break;
 case 'admin-clean-test-data':confirm('Limpiar datos operativos','Esto borrará clientes, vehículos, órdenes, cotizaciones, citas, ventas y movimientos. Se conservarán inventario, servicios, técnicos y configuración.','confirm-admin-clean-test-data');break;
 case 'confirm-admin-clean-test-data':await superadmin.cleanTestData();commerce.resetCart();reception.clearReception();closeModal();shell();location.hash='/superadmin';render();toast('Datos operativos limpiados');break;
 case 'edit-client':entities.editClient(id);break;
 case 'delete-client':confirm('Eliminar cliente',`¿Eliminar a ${esc(ui.client(id)?.name)}? Los clientes con registros asociados deben desactivarse para conservar su historial.`,'confirm-delete-client',`data-id="${id}"`);break;
 case 'confirm-delete-client':await store.removeClient(id);closeModal();render();toast('Cliente eliminado');break;
 case 'new-vehicle':await entities.editVehicle(null,{});break;
 case 'edit-vehicle':entities.editVehicle(id);break;
 case 'auto-vehicle':await entities.autoVehicle();break;
 case 'vehicle-qr':entities.qrModal(id);break;
 case 'new-document':modal('Agregar referencia de documento',`<form id="document-form" data-id="${id}" class="form-grid">${field('Nombre (SOAT, revisión, etc.)','name','','text','required')}${field('Vencimiento','expiry',day(180),'date','required')}${formFooter()}</form>`);break;
 case 'new-reminder':modal('Nuevo recordatorio',`<form id="reminder-form" data-id="${id}" class="form-grid">${field('Mantenimiento','title','','text','required')}${field('Kilometraje objetivo','km','','number','min="0" max="9999999"')}${field('Fecha objetivo','date',day(90),'date','required')}${formFooter()}</form>`);break;
 case 'complete-reminder':await store.transaction(d=>d.vehicles.find(v=>v.id===id).reminders.find(r=>r.id===target.dataset.reminder).status='COMPLETADO');render();toast('Recordatorio completado');break;
 case 'new-product':entities.editProduct();break;
 case 'edit-product':entities.editProduct(id);break;
 case 'move-product':modal('Movimiento de inventario',`<form id="movement-form" data-id="${id}" class="form-grid"><div class="wide callout">${esc(store.get('products',id).name)} · Stock actual: ${store.get('products',id).stock}</div>${field('Unidades (+ entrada / − salida)','quantity','','number','required step="1"')}${field('Motivo','reason','','text','required')}${formFooter('Registrar')}</form>`);break;
 case 'identify-photo':await intelligent.openPhotoIdentification();break;
 case 'identify-qr':await reception.identifyQr();break;
 case 'focus-plate':document.getElementById('identify-plate').focus();break;
 case 'unknown-register':entities.editVehicle(null,{plate:target.dataset.plate});break;
 case 'unknown-lookup':entities.editVehicle(null,{plate:target.dataset.plate});await entities.autoVehicle();break;
 case 'reception-back':reception.receptionDraft.step--;render();break;
 case 'remove-damage':reception.receptionDraft.damage.splice(Number(index),1);render();break;
 case 'clear-reception-photos':reception.receptionDraft.photos=[];render();break;
 case 'cancel-reception':confirm('Cancelar recepción','Se descartarán los datos y fotos de esta recepción sin guardar.','confirm-cancel-reception');break;
 case 'confirm-cancel-reception':reception.clearReception();closeModal();location.hash='/reception';break;
 case 'new-order-item':orders.newOrderItem(id,kind);break;
 case 'remove-order-item':await store.transaction(d=>{const o=d.orders.find(x=>x.id===id);o.items=o.items.filter(i=>i.id!==target.dataset.item);o.events.unshift({date:new Date().toISOString(),text:'Ítem retirado de la orden'});});render();break;
 case 'quote-from-order':commerce.newQuote(id);break;
 case 'new-quote':commerce.newQuote();break;
 case 'quote-state':await commerce.quoteState(id,target.dataset.state);render();break;
 case 'invoice-quote':commerce.invoiceQuote(id);break;
 case 'print':window.print();break;
 case 'share-quote':toast((await notificationsAdapter.share(store.get('quotes',id))).message);break;
 case 'add-cart':commerce.addCart(id,kind);refreshCart();break;
 case 'cart-remove':commerce.cart.splice(Number(index),1);refreshCart();break;
 case 'cart-minus':if(commerce.cart[index].quantity>1)commerce.cart[index].quantity--;else commerce.cart.splice(Number(index),1);refreshCart();break;
 case 'cart-plus':commerce.addCart(commerce.cart[index].catalogId,commerce.cart[index].kind);refreshCart();break;
 case 'clear-cart':commerce.resetCart();render();break;
 case 'focus-cart':document.querySelector('.pos-cart').scrollIntoView({behavior:'smooth',block:'start'});break;
 case 'checkout':commerce.checkout();break;
 case 'confirm-checkout':await commerce.confirmCheckout();render();break;
 case 'cart-quote':await commerce.cartQuote();break;
 case 'open-cash':commerce.openCash();break;
 case 'close-cash':commerce.closeCash();break;
 case 'cash-movement':commerce.cashMovement();break;
 case 'new-appointment':operations.editAppointment(null,target.dataset.date);break;
 case 'edit-appointment':operations.editAppointment(id);break;
 case 'agenda-prev':case 'agenda-next':{const d=new Date(operations.agendaDate+'T12:00:00');d.setDate(d.getDate()+(action==='agenda-prev'?-7:7));operations.setAgendaDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);render();break;}
 case 'agenda-today':operations.setAgendaDate(day());render();break;
 case 'view-technician':operations.technicianDetail(id);break;
 case 'new-technician':modal('Nuevo técnico',`<form id="technician-form" class="form-grid">${field('Nombre','name','','text','required')}${field('Especialidad','specialty','','text','required')}${field('Teléfono','phone','','tel','required')}${selectField('Estado','status','<option>DISPONIBLE</option><option>INACTIVO</option>')}${formFooter()}</form>`);break;
 case 'new-service':case 'edit-service':{const s=store.get('services',id)||{};modal(id?'Editar servicio':'Nuevo servicio',`<form id="service-form" data-id="${id||''}" class="form-grid">${field('Servicio','name',s.name,'text','required')}${field('Precio COP','price',s.price||0,'number','required min="0" step="1"')}${formFooter()}</form>`);break;}
 case 'export-report':{const cutoff=day(1-Number(operations.reportRange));const rows=[['Venta','Fecha','Cliente','Medio','Total COP'],...store.data.sales.filter(s=>s.date>=cutoff&&s.date<=day()).map(s=>[s.number,s.date,ui.client(s.clientId)?.name||'Consumidor final',s.method,ui.total(s)])];ui.download('tallerpro-ventas.csv','\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(';')).join('\r\n'),'text/csv;charset=utf-8');toast('Reporte exportado');break;}
 case 'export-data':ui.download('tallerpro-respaldo.json',JSON.stringify(store.data,null,2));toast('Copia exportada');break;
 case 'reset-demo':confirm('Restablecer datos DEMO','Esta acción eliminará los cambios locales, fotografías, ventas y recepciones creadas. Puedes exportar una copia antes de continuar.','confirm-reset');break;
 case 'confirm-reset':await store.reset();commerce.resetCart();reception.clearReception();closeModal();shell();render();toast('Datos DEMO restablecidos');break;
 }
 }catch(error){intelligent.identificationError(error);}
});
document.addEventListener('submit',async event=>{event.preventDefault();const form=event.target;if(!form.reportValidity())return;try{if(['smart-correction-form','qr-input-form'].includes(form.id)){intelligent.identificationSubmit(form);return;}const values=Object.fromEntries(new FormData(form));switch(form.id){
 case 'client-form':await entities.saveClient(form);break;
 case 'quote-invoice-form':await commerce.confirmQuoteInvoice(form);break;
 case 'quick-client-form':await saveQuickClient(form);break;
 case 'vehicle-form':await entities.saveVehicle(form);break;
 case 'product-form':await entities.saveProduct(form);break;
 case 'identify-form':reception.showFound(values.plate);return;
 case 'reception-form':await reception.nextReception(form);break;
 case 'order-item-form':await orders.saveOrderItem(form);break;
 case 'order-notes-form':await store.put('orders',{...store.get('orders',form.dataset.id),...values});toast('Diagnóstico y notas guardados');break;
 case 'quote-form':await commerce.saveQuote(form);break;
 case 'appointment-form':await operations.saveAppointment(form);break;
 case 'document-form':await store.transaction(d=>d.vehicles.find(v=>v.id===form.dataset.id).documents.push({...values,id:uid('doc')}));closeModal();toast('Referencia registrada');break;
 case 'reminder-form':await store.transaction(d=>d.vehicles.find(v=>v.id===form.dataset.id).reminders.push({...values,id:uid('reminder'),km:Number(values.km),status:values.date<day()?'VENCIDO':'PRÓXIMO'}));closeModal();toast('Recordatorio creado');break;
 case 'movement-form':{const quantity=Number(values.quantity);if(!quantity)throw new Error('Ingresa una cantidad distinta de cero.');await store.transaction(d=>{const p=d.products.find(x=>x.id===form.dataset.id);if(p.stock+quantity<0)throw new Error('La salida supera el stock disponible.');p.stock+=quantity;d.movements.unshift({id:uid('mov'),productId:p.id,quantity,reason:values.reason,date:new Date().toISOString()});});closeModal();toast('Movimiento registrado');break;}
 case 'open-cash-form':await store.transaction(d=>{if(d.cash.open)throw new Error('La caja ya está abierta.');d.cash.open=true;d.cash.initial=Number(values.initial);d.cash.openedAt=day();d.cash.movements=[];});closeModal();toast('Caja abierta');break;
 case 'close-cash-form':{const s=commerce.cashSummary();await store.transaction(d=>{if(!d.cash.open)throw new Error('La caja ya está cerrada.');d.cash.history.unshift({id:uid('close'),date:new Date().toISOString(),initial:d.cash.initial,expected:s.balance,counted:Number(values.counted),saleIds:s.sales.map(s=>s.id),movements:structuredClone(d.cash.movements)});d.cash.open=false;d.cash.movements=[];d.cash.initial=0;});closeModal();toast('Caja cerrada. Cierre guardado.');break;}
 case 'cash-movement-form':await store.transaction(d=>{if(!d.cash.open)throw new Error('Abre la caja para registrar movimientos.');if(values.kind==='Egreso'&&values.method==='Efectivo'&&Number(values.amount)>commerce.cashSummary().balance)throw new Error('El egreso supera el efectivo disponible.');d.cash.movements.push({...values,id:uid('cash'),amount:Number(values.amount),date:new Date().toISOString()});});closeModal();toast('Movimiento de caja registrado');break;
 case 'technician-form':await store.put('technicians',values);closeModal();toast('Técnico creado');break;
 case 'service-form':await store.put('services',{...(store.get('services',form.dataset.id)||{}),...values,category:'Servicios',price:Number(values.price)});closeModal();toast('Servicio guardado');break;
 case 'settings-form':await store.transaction(d=>d.settings={...d.settings,...values});shell();toast('Configuración guardada');break;
 }render();}catch(error){toast(error.message);}});
document.addEventListener('input',event=>{const t=event.target;if(t.id==='list-search')refreshList();if(t.id==='global-search')globalSearch(t.value);if(t.id==='pos-search')document.getElementById('catalog-results').innerHTML=commerce.catalogRows(t.value,document.getElementById('pos-category').value);if(t.name==='pos-discount'){if(t.validity.valid){commerce.posState.discount=Number(t.value);document.getElementById('cart-total').innerHTML=commerce.cartTotal();}}});
document.addEventListener('change',async event=>{const t=event.target;try{
 if(t.dataset.catalogLevel){await catalogChanged(t);return;}
 if(['smart-file','qr-file'].includes(t.id)){await intelligent.identificationChange(t);return;}
 if(t.id==='list-filter')refreshList();
 if(t.id==='vehicle-photos'&&t.files.length){await entities.addVehiclePhotos(t);render();}
 if(t.id==='identify-image'&&t.files.length)await reception.identifyPhoto(t.files[0]);
 if(t.dataset.receptionPhoto&&t.files.length){await reception.addReceptionPhoto(t);render();}
 if(t.dataset.orderState){await orders.updateOrderState(t.dataset.orderState,t.value);render();}
 if(t.dataset.itemState){await store.transaction(d=>{const o=d.orders.find(x=>x.id===t.dataset.order);o.items.find(x=>x.id===t.dataset.itemState).status=t.value;o.events.unshift({date:new Date().toISOString(),text:`Trabajo actualizado: ${t.value}`});});toast('Trabajo actualizado');}
 if(t.dataset.itemCatalog){const row=store.get(t.dataset.itemCatalog==='service'?'services':'products',t.value);t.form.elements.name.value=row.name;t.form.elements.price.value=row.price;}
 if(t.id==='pos-category')document.getElementById('catalog-results').innerHTML=commerce.catalogRows(document.getElementById('pos-search').value,t.value);
 if(t.name==='pos-client'){commerce.posState.clientId=t.value;commerce.posState.vehicleId='';render();}
 if(t.name==='pos-vehicle')commerce.posState.vehicleId=t.value;
 if(t.name==='pos-method')commerce.posState.method=t.value;
 if(t.dataset.cartQuantity!==undefined){const p=commerce.cart[Number(t.dataset.cartQuantity)],quantity=Number(t.value);if(!Number.isInteger(quantity)||quantity<1||quantity>999)throw new Error('Cantidad inválida. Usa un entero entre 1 y 999.');if(p.kind==='product'&&quantity>store.get('products',p.productId).stock)throw new Error('La cantidad supera el stock disponible.');p.quantity=quantity;refreshCart();}
 if(t.id==='agenda-date'&&t.value){operations.setAgendaDate(t.value);render();}
 if(t.id==='report-range'){operations.setReportRange(t.value);render();}
 }catch(error){intelligent.identificationError(error);if(t.dataset.orderState)render();if(t.dataset.cartQuantity!==undefined)refreshCart();}});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.getElementById('global-search').focus();}if(event.key==='Escape'){closeModal();document.getElementById('global-results').hidden=true;document.body.classList.remove('sidebar-open');}if(event.target.id==='damage-map'&&['Enter',' '].includes(event.key)){event.preventDefault();reception.markDamage(event,event.target);render();}const dialog=document.querySelector('.modal');if(dialog&&event.key==='Tab'){const focusable=[...dialog.querySelectorAll('button,input,textarea,select,a[href]')].filter(x=>!x.disabled&&x.offsetParent!==null),first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
window.addEventListener('hashchange',()=>{closeModal();document.body.classList.remove('sidebar-open');render();window.scrollTo(0,0);});
window.addEventListener('storage',event=>{if(event.key===config.storageKey)toast('Los datos cambiaron en otra pestaña. Recarga para ver la versión actual.');});
shell();render();

function cloudStatus(){const el=document.getElementById('cloud-status');if(!el)return;el.dataset.error=String(!!store.uncertain);el.innerHTML=store.busy?'Guardando en el servidor…':store.uncertain?'Guardado sin confirmar <button class="text-link" data-action="cloud-retry-save">Reintentar guardado</button>':'Conectado · D1 + R2 · V0.4 <button class="text-link" data-action="cloud-refresh">Actualizar datos</button>';document.body.classList.toggle('cloud-saving',!!store.busy);}
window.addEventListener('tallerpro:saving',cloudStatus);window.addEventListener('tallerpro:saved',cloudStatus);

window.addEventListener('tallerpro:upload',event=>{document.getElementById('upload-progress')?.remove();if(!event.detail)return;const panel=document.createElement('div');panel.id='upload-progress';panel.className='upload-progress';panel.setAttribute('role','status');panel.innerHTML=`<img src="${esc(event.detail.preview)}" alt="Vista previa de la fotografía"><div><b>Subiendo fotografía…</b><small>${esc(event.detail.label)}</small></div>`;document.body.append(panel);});
