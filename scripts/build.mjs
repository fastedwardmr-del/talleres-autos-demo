import {mkdir,cp,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dataMode=process.env.DATA_MODE||'api',apiBase=process.env.API_BASE_URL||'';
if(!['api','local'].includes(dataMode))throw new Error('DATA_MODE debe ser api o local');
if(dataMode==='api'&&!/^https:\/\/[\w.-]+(?::\d+)?$|^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(apiBase))throw new Error('API_BASE_URL debe ser un origen HTTPS válido (o localhost para pruebas)');
await mkdir('dist',{recursive:true});for(const path of ['index.html','js','css','assets'])await cp(path,'dist/'+path,{recursive:true});
await writeFile('dist/js/runtime-config.js',`export const runtime = ${JSON.stringify({dataMode,apiBase,companyId:'demo'})};\n`);
await writeFile('dist/_redirects','/* /index.html 200\n');
await writeFile('dist/_headers',`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(self), microphone=()\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: ${apiBase}; connect-src 'self' ${apiBase}; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\n  Cache-Control: no-cache\n`);
console.log(`Frontend preparado: ${dataMode}, ${apiBase||'local'}. Solo dist/ debe desplegarse.`);

// A shared content fingerprint invalidates the ES module graph after a deployment.
async function javascriptFiles(dir){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())result.push(...await javascriptFiles(path));else if(path.endsWith('.js'))result.push(path);}return result.sort();}
const jsFiles=await javascriptFiles('dist/js'),hash=createHash('sha256');
for(const file of jsFiles)hash.update(await readFile(file));const buildId=hash.digest('hex').slice(0,12);
for(const file of jsFiles){const source=await readFile(file,'utf8');await writeFile(file,source.replace(/(['"])(\.{1,2}\/[^'"?]+\.js)\1/g,(_,quote,path)=>quote+path+'?v='+buildId+quote));}
const html=await readFile('dist/index.html','utf8');await writeFile('dist/index.html',html.replace('src="js/bootstrap.js"','src="js/bootstrap.js?v='+buildId+'"'));
