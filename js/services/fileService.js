import {cloudMode,apiRequest} from './apiClient.js';
import {fileAdapter} from './adapters.js';

const MAX_UPLOAD_BYTES = 1500000;
const MAX_IMAGE_SIDE = 1600;
const ACCEPTED_TYPES = ['image/jpeg','image/png','image/webp'];

function loadImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{ URL.revokeObjectURL(url); resolve(img); };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error('No fue posible procesar la fotografía.')); };
    img.src=url;
  });
}

function canvasToBlob(canvas,type,quality){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No fue posible comprimir la fotografía.')),type,quality);
  });
}

async function optimizePhoto(file){
  if(!file) throw new Error('No se recibió ninguna fotografía.');
  if(!ACCEPTED_TYPES.includes(file.type)) throw new Error('Selecciona una fotografía JPEG, PNG o WebP.');

  // Las imágenes pequeñas pueden subirse sin reprocesarlas.
  if(file.size<=MAX_UPLOAD_BYTES) return file;

  const img=await loadImage(file);
  const scale=Math.min(1,MAX_IMAGE_SIDE/Math.max(img.naturalWidth,img.naturalHeight));
  const width=Math.max(1,Math.round(img.naturalWidth*scale));
  const height=Math.max(1,Math.round(img.naturalHeight*scale));

  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d');
  if(!ctx) throw new Error('El navegador no pudo preparar la fotografía.');

  // Fondo blanco evita transparencias negras al convertir PNG/WebP a JPEG.
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,width,height);
  ctx.drawImage(img,0,0,width,height);

  let quality=0.86;
  let blob=await canvasToBlob(canvas,'image/jpeg',quality);
  while(blob.size>MAX_UPLOAD_BYTES && quality>0.50){
    quality-=0.08;
    blob=await canvasToBlob(canvas,'image/jpeg',quality);
  }

  if(blob.size>MAX_UPLOAD_BYTES){
    throw new Error('La fotografía sigue siendo demasiado grande después de optimizarla. Intenta tomarla con menor resolución.');
  }

  const baseName=(file.name||'foto').replace(/\.[^.]+$/,'');
  return new File([blob],`${baseName}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
}

export async function savePhoto(file,{vehicleId,receptionId='',label=file?.name||'Fotografía'}={}){
  const prepared=await optimizePhoto(file);

  if(!cloudMode()) return {label,url:await fileAdapter.read(prepared)};

  const form=new FormData();
  form.append('image',prepared);
  form.append('vehicleId',vehicleId);
  form.append('receptionId',receptionId);
  form.append('label',label);

  const preview=URL.createObjectURL(prepared);
  window.dispatchEvent(new CustomEvent('tallerpro:upload',{detail:{preview,label}}));
  try{
    return await apiRequest('/api/files',{method:'POST',body:form});
  }finally{
    window.dispatchEvent(new CustomEvent('tallerpro:upload',{detail:null}));
    URL.revokeObjectURL(preview);
  }
}
