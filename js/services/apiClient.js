import {runtime} from '../runtime-config.js';
export class ApiError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code;}}
let token=globalThis.sessionStorage?.getItem('tallerpro.cloud.session')||'';
export const hasSession=()=>!!token;
export function clearSession(){token='';globalThis.sessionStorage?.removeItem('tallerpro.cloud.session');}
export async function apiRequest(path,{method='GET',body,headers={},timeout=20000}={}){
 const options={method,headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},cache:'no-store',signal:AbortSignal.timeout(timeout)};
 if(body instanceof FormData)options.body=body;else if(body!==undefined){options.body=JSON.stringify(body);options.headers['Content-Type']='application/json';}
 let response;try{response=await fetch(runtime.apiBase+path,options);}catch{throw new ApiError('No se pudo conectar al taller. Revisa tu conexión y vuelve a intentar.',0,'NETWORK');}
 let payload;try{payload=await response.json();}catch{throw new ApiError('El servidor no devolvió una respuesta válida.',response.status,'RESPONSE');}
 if(!response.ok||!payload.ok){if(response.status===401){clearSession();globalThis.dispatchEvent?.(new Event('tallerpro:session-expired'));}throw new ApiError(payload.error?.message||'No fue posible completar la operación.',response.status,payload.error?.code);}
 return payload.data;
}
export async function openSession(code){const result=await apiRequest('/api/session',{method:'POST',body:{code}});token=result.token;sessionStorage.setItem('tallerpro.cloud.session',token);return result;}
export const cloudMode=()=>runtime.dataMode==='api';
