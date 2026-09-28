import {uid} from './localStore.js';
import {normalizeVehicle,validPlate,normalizePlate} from './vehicleIdentity.js';
import {apiRequest} from './apiClient.js';
const collections=['clients','technicians','products','services','vehicles','orders','quotes','appointments','sales','movements','activity'];
const clean=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='url'&&typeof v==='string'&&v.includes('/api/files/')?undefined:v));
function diff(before,after){const changes=[];for(const type of collections){const old=new Map(before[type].map(v=>[v.id,clean(v)]));for(const raw of after[type]){const value=clean(raw);if(JSON.stringify(value)!==JSON.stringify(old.get(value.id)))changes.push({type,value});old.delete(value.id);}for(const id of old.keys())changes.push({type,id,remove:true});}for(const type of ['cash','settings'])if(JSON.stringify(before[type])!==JSON.stringify(after[type]))changes.push({type,value:after[type]});return changes;}
export class ApiStore{
 constructor(request=apiRequest){this.request=request;this.mode='api';this.data=null;this.revision=null;this.busy=false;this.uncertain=null;}
 async refresh(){if(this.busy)return;const loaded=await this.request('/api/state');this.data=loaded.state;this.revision=loaded.revision;return this.data;}
 list(type){return this.data[type];}
 get(type,id){return this.data[type].find(x=>x.id===id);}
 async send(path,body){if(this.busy)throw new Error('Espera a que termine el guardado anterior.');if(this.uncertain)throw new Error('Hay una operación pendiente de confirmar. Usa Reintentar guardado.');this.busy=true;globalThis.dispatchEvent?.(new Event('tallerpro:saving'));const request={...body,revision:this.revision,requestId:uid('request')};try{const result=await this.request(path,{method:'POST',body:request});this.data=result.state;this.revision=result.revision;return result.result;}catch(error){if(error.status===0||error.status>=500)this.uncertain={path,body:request};if(error.status===409){const loaded=await this.request('/api/state');this.data=loaded.state;this.revision=loaded.revision;}throw error;}finally{this.busy=false;globalThis.dispatchEvent?.(new Event('tallerpro:saved'));}}
 async retry(){if(!this.uncertain)return this.refresh();const pending=this.uncertain;this.busy=true;try{const result=await this.request(pending.path,{method:'POST',body:pending.body});this.data=result.state;this.revision=result.revision;this.uncertain=null;}catch(error){if(error.status===409){this.uncertain=null;await this.request('/api/state').then(r=>{this.data=r.state;this.revision=r.revision;});}throw error;}finally{this.busy=false;globalThis.dispatchEvent?.(new Event('tallerpro:saved'));}}
 async transaction(fn){const next=structuredClone(this.data),result=fn(next);for(const r of next.activity)r.id||=uid('activity');const changes=diff(this.data,next);if(changes.length)await this.send('/api/transactions',{changes});return result;}
 async put(type,value){const id=value.id||value.vehicle_id||uid(type);let record={...value,id};if(type==='vehicles'){record=normalizeVehicle(record,this.get(type,id));if(!validPlate(record.plate))throw new Error('Placa inválida.');if(this.data.vehicles.some(v=>v.id!==id&&normalizePlate(v.plate)===record.plate))throw new Error('La placa ya está registrada.');}await this.transaction(d=>{const index=d[type].findIndex(x=>x.id===id);if(index<0)d[type].push(record);else d[type][index]=record;});return this.get(type,id);}
 async removeClient(id){await this.transaction(d=>{d.clients=d.clients.filter(c=>c.id!==id);});}
 async checkout(sale){return this.send('/api/sales',{sale});}
 async cleanOperationalData(){return this.send('/api/admin/clean',{});}
 async log(text){await this.transaction(d=>d.activity.unshift({id:uid('activity'),date:new Date().toISOString(),text}));}
 reset(){throw new Error('El restablecimiento está deshabilitado en CLOUD.');}
}
