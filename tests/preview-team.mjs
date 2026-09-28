// Disposable browser QA: in-memory SQLite, no disk DB, Cloudflare or external secrets.
// First build with API_BASE_URL=http://127.0.0.1:4188, then run this file.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {SQLiteD1,MemoryR2} from './helpers/sqlite-d1.mjs';
import {seedSql} from '../scripts/seed.mjs';
import {passwordRecord} from '../backend/cloud/passwords.js';
import {handleCloud} from '../backend/cloud/worker.js';
const env={DB:new SQLiteD1(),FILES:new MemoryR2(),SESSION_SECRET:crypto.randomUUID()};env.DB.sqlite.exec(seedSql());
const password=crypto.randomUUID(),record=await passwordRecord(password);
for(const [id,name,role,tech] of [['qa-admin','Administración QA','ADMIN',null],['qa-tecnico','Técnico QA','TECNICO','t1']]){
 env.DB.sqlite.prepare("INSERT INTO users VALUES('demo',?,?,?)").run(id,name,role);
 env.DB.sqlite.prepare("INSERT INTO user_credentials(company_id,user_id,password_hash,password_salt,password_iterations,technician_id) VALUES('demo',?,?,?,?,?)").run(id,record.password_hash,record.password_salt,record.password_iterations,tech);
}
const root=path.resolve('dist'),port=4188,types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{try{
 if(!['127.0.0.1:4188','localhost:4188'].includes(req.headers.host)){res.writeHead(403).end();return;}
 const url=new URL(req.url,'http://127.0.0.1:'+port);
 if(url.pathname.startsWith('/api/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const response=await handleCloud(new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env);res.writeHead(response.status,Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
 }catch{res.writeHead(404).end('No encontrado');}
}).listen(port,'127.0.0.1',()=>console.log(`QA temporal http://127.0.0.1:${port}\nUsuarios: qa-admin / qa-tecnico\nContraseña temporal para ambos: ${password}`));
