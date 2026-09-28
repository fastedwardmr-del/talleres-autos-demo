import {vehicleRecognitionService} from './vehicleRecognitionService.js';
import {vehicleLookupService} from './vehicleLookupService.js';
import {qrPayload,parseVehicleQr} from './qrService.js';
// Fachadas compatibles con V0.1; el formato externo queda en backend/providers.js.
export const recognitionAdapter={identify:(image,options)=>vehicleRecognitionService.analyze(image,options)};
export const vehicleAdapter={lookup:(plate,ownerDocument='',consent=false)=>vehicleLookupService.lookup({plate,ownerDocument,consent})};
export const qrAdapter={async scan(value){return {vehicleId:parseVehicleQr(value),simulated:false};},payload:qrPayload};
export const notificationsAdapter={async share(quote){return {simulated:true,message:`Cotización ${quote.number} preparada. No se envió ninguna notificación real.`};}};
export const fileAdapter={async read(file){if(!file.type.startsWith('image/'))throw new Error('Selecciona un archivo de imagen.');if(file.size>1500000)throw new Error('Cada foto debe pesar menos de 1,5 MB.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('No se pudo leer la imagen.'));reader.readAsDataURL(file);});}};
