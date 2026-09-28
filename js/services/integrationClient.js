import {cloudMode,apiRequest} from './apiClient.js';
export const defaultIntegrations = {recognition:{mode:'demo',provider:'Plate Recognizer',state:'MODO DEMO'},catalog:{mode:'local',provider:'Catálogo TallerPro',state:'CATÁLOGO LOCAL'},lookup:{mode:'unconfigured',provider:'Consulta opcional',state:'NO CONFIGURADO',requiresDocument:false},qr:{state:'ACTIVO'}};
export async function requestJSON(path,options={},fetcher=globalThis.fetch,timeout=12000){
 if(cloudMode()&&fetcher===globalThis.fetch){let body=options.body;if(typeof body==='string')body=JSON.parse(body);return apiRequest(path,{method:options.method||'GET',body,timeout});}
 const response=await fetcher(path,{...options,signal:AbortSignal.timeout(timeout),cache:'no-store'});
 if(!response.ok)throw new Error(response.status===429?'Límite del proveedor agotado.':response.status===413?'La imagen supera el tamaño permitido.':'El servicio no está disponible. Continúa manualmente.');
 return response.json();
}
export async function getIntegrations(fetcher=globalThis.fetch){try{return await requestJSON('/api/integrations',{},fetcher,3500);}catch{return structuredClone(defaultIntegrations);}}
