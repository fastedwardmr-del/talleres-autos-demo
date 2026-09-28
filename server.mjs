import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {handleApi,MAX_BODY} from './backend/api.js';
import {publicPath} from './backend/staticPolicy.js';
import {queryCatalog} from './backend/cloud/catalog.js';
import {findVehicleImage} from './backend/cloud/vehicleImages.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const root=process.cwd(),port=Number(process.env.PORT)||4173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'};
http.createServer(async(req,res)=>{try{
 if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)){res.writeHead(403).end('Host no permitido');return;}
 const url=new URL(req.url,`http://${req.headers.host}`),pathname=decodeURIComponent(url.pathname);
 if(pathname.startsWith('/api/')){
   // En desarrollo, el catálogo usa el mismo proxy gratuito que producción.
   // Esto permite probar Marca → Modelo → Año con `npm start`, sin D1 ni un segundo servidor.
   if(pathname==='/api/vehicle-image'&&req.method==='GET'){
     try{
       const data=await findVehicleImage(url);
       const body=JSON.stringify({ok:true,data});
       res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}).end(body);
     }catch(error){
       const status=error.status||503,body=JSON.stringify({ok:false,error:{code:error.code||'IMAGE_PROVIDER',message:error.message||'Imagen de referencia no disponible'}});
       res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(body);
     }
     return;
   }
   if(pathname.startsWith('/api/catalog/')&&req.method==='GET'){
     try{
       const data=await queryCatalog(null,url);
       const body=JSON.stringify({ok:true,data});
       res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(body);
     }catch(error){
       const status=error.status||503,body=JSON.stringify({ok:false,error:{code:error.code||'CATALOG_PROVIDER',message:error.message||'Catálogo no disponible'}});
       res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(body);
     }
     return;
   }
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY){res.writeHead(413).end('Archivo demasiado grande');return;}chunks.push(chunk);}
   const response=await handleApi(new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),process.env);
   res.writeHead(response.status,Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));return;
 }
 if(!['GET','HEAD'].includes(req.method)||!publicPath(pathname)){res.writeHead(404).end('No encontrado');return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(self), microphone=()'}).end(req.method==='HEAD'?undefined:body);
}catch{res.writeHead(400).end('Solicitud no válida');}}).listen(port,'127.0.0.1',()=>console.log(`TallerPro V0.4: http://localhost:${port}`));
