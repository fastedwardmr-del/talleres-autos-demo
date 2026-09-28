export class CameraSession {
 constructor(media=globalThis.navigator?.mediaDevices){this.media=media;this.stream=null;this.generation=0;}
 stop(){this.generation++;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;}
 async start(video){this.stop();const token=this.generation;if(!this.media?.getUserMedia)throw new Error('No fue posible acceder a la cámara. Puedes seleccionar una fotografía.');
 try{const stream=await this.media.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}this.stream=stream;video.srcObject=stream;await video.play();return true;}
 catch{this.stop();throw new Error('No fue posible acceder a la cámara. Puedes seleccionar una fotografía.');}}
 async capture(video){if(!video.videoWidth)throw new Error('Espera a que la cámara muestre la imagen.');const canvas=document.createElement('canvas'),scale=Math.min(1,1280/video.videoWidth);canvas.width=video.videoWidth*scale;canvas.height=video.videoHeight*scale;canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));if(!blob)throw new Error('No se pudo capturar la imagen.');return new File([blob],'captura.jpg',{type:'image/jpeg'});}
}
