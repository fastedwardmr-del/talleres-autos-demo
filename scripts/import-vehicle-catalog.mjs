import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {catalogSearch,explicitYears} from '../js/services/catalogNormalization.js';
export const SOURCE_COMMIT='b4965631140fa82404359167621274601da69a5b';
export const SOURCE_URL='https://github.com/gor3a/vehicle-makes-models';
const clean=v=>v==null?null:String(v).normalize('NFC').trim().replace(/\s+/g,' ');
const id=(kind,...parts)=>kind+'-'+createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0,24);
const quote=v=>v==null?'NULL':typeof v==='number'?String(v):"'"+v.replaceAll("'","''")+"'";
export function convertCatalog(db,{commit=SOURCE_COMMIT,sha256='fixture',importedAt=new Date().toISOString()}={}){
 const rows={vehicle_catalog_sources:[{id:'gor3a',repository:SOURCE_URL,source_commit:commit,license:'ODbL-1.0',imported_at:importedAt,sha256}],vehicle_makes:[],vehicle_models:[],vehicle_generations:[],vehicle_engines:[],vehicle_model_years:[]};
 const maps={},duplicates={},seen={};
 const add=(table,row)=>{seen[table]??=new Map();if(seen[table].has(row.id)){duplicates[table]=(duplicates[table]||0)+1;return seen[table].get(row.id);}seen[table].set(row.id,row);rows[table].push(row);return row;};
 for(const [table,parent,fk,target] of [['makes',null,null,'vehicle_makes'],['models','makes','make_id','vehicle_models'],['generations','models','model_id','vehicle_generations'],['engines','generations','generation_id','vehicle_engines']]){
  maps[table]=new Map();
  for(const raw of db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()){
   const name=clean(raw.name??raw.label);if(!name||name.length>300)throw new Error(`Nombre inválido ${table}:${raw.id}`);
   const parentId=parent?maps[parent].get(raw[fk]):null;if(parent&&!parentId)throw new Error(`Relación inválida ${table}:${raw.id}`);
   if(table==='models'||table==='generations'){if(raw.year_start!==null)explicitYears(raw.year_start,raw.year_end);if(raw.year_start===null&&raw.year_end!==null)throw new Error('Fin sin inicio');}
   const parts=[parentId,catalogSearch(name)];
   if(table==='generations')parts.push(raw.year_start,raw.year_end);
   if(table==='engines')parts.push(raw.fuel_type,raw.displacement_cc,raw.power_hp,raw.transmission,raw.drivetrain,raw.cylinders);
   const row={id:id(table,...parts),...(parent?{[fk]:parentId}:{}),name,search_key:catalogSearch(name),...(table==='makes'?{country:clean(raw.country),source:'gor3a'}:{}),...(['models','generations'].includes(table)?{year_start:raw.year_start,year_end:raw.year_end}:{}),...(table==='generations'?{body_type:clean(raw.body_type)}:{}),...(table==='engines'?{fuel:clean(raw.fuel_type),displacement:raw.displacement_cc,power:raw.power_hp,transmission:clean(raw.transmission),drive:clean(raw.drivetrain),cylinders:raw.cylinders}:{}),source_id:String(raw.id),active:1};
   for(const k of ['displacement','power','cylinders'])if(row[k]!=null&&(!Number.isFinite(row[k])||row[k]<0))throw new Error(`Número inválido ${k}`);
   add(target,row);maps[table].set(raw.id,row.id);
  }
 }
 const yearSet=new Set(),withGenerations=new Set(rows.vehicle_generations.map(g=>g.model_id));
 for(const g of [...rows.vehicle_generations,...rows.vehicle_models.filter(m=>!withGenerations.has(m.id)).map(m=>({...m,model_id:m.id}))])for(const year of explicitYears(g.year_start,g.year_end)){
  const key=g.model_id+':'+year;if(!yearSet.has(key)){rows.vehicle_model_years.push({model_id:g.model_id,year});yearSet.add(key);}
 }
 return {rows,duplicates};
}
export function catalogSQL(rows){
 return Object.entries(rows).flatMap(([table,records])=>records.map(row=>{
  const keys=Object.keys(row),conflict=table==='vehicle_model_years'?'model_id,year':'id';
  return `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(k=>quote(row[k])).join(',')}) ON CONFLICT(${conflict}) ${table==='vehicle_model_years'?'DO NOTHING':'DO UPDATE SET '+keys.filter(k=>k!=='id').map(k=>`${k}=excluded.${k}`).join(',')};`;
 })).join('\n')+'\n';
}
async function main(){
 const args=process.argv.slice(2),commit=args.find(a=>a.startsWith('--commit='))?.split('=')[1]||SOURCE_COMMIT;
 if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Usa un commit completo');
 const input=args.find(a=>a.startsWith('--input='))?.slice(8)||'.catalog-source/vehicles.sqlite';
 mkdirSync('.catalog-source',{recursive:true});mkdirSync('.catalog-build',{recursive:true});mkdirSync('assets/catalog',{recursive:true});
 if(args.includes('--download')){const r=await fetch(`https://raw.githubusercontent.com/gor3a/vehicle-makes-models/${commit}/data/vehicles.sqlite`);if(!r.ok)throw new Error(`Descarga ${r.status}`);writeFileSync(input,Buffer.from(await r.arrayBuffer()));}
 if(!existsSync(input))throw new Error('Falta SQLite; usa --download o --input=archivo');
 const bytes=readFileSync(input),sha256=createHash('sha256').update(bytes).digest('hex');
 const db=new DatabaseSync(input,{readOnly:true});if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('SQLite inválido');
 const {rows,duplicates}=convertCatalog(db,{commit,sha256});db.close();const sql=catalogSQL(rows);writeFileSync('.catalog-build/import.sql',sql);
 const years=rows.vehicle_model_years.map(r=>r.year),report={repository:SOURCE_URL,commit,sha256,license:'ODbL-1.0',importedAt:rows.vehicle_catalog_sources[0].imported_at,counts:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length])),duplicates,yearMin:Math.min(...years),yearMax:Math.max(...years),sourceBytes:bytes.length,sqlBytes:Buffer.byteLength(sql),openRanges:rows.vehicle_generations.filter(g=>g.year_end===null).length};
 // Standalone adapted database download, never contains customers/business data.
 const archive=gzipSync(Buffer.from('-- Catalogo adaptado TallerPro. ODbL 1.0. Attribution: vehicle-makes-models / autoevolution.com.\n'+readFileSync('migrations/0002_vehicle_catalog.sql','utf8')+'\n'+sql));
 writeFileSync('assets/catalog/catalog.sql.gz',archive);report.downloadBytes=archive.length;
 writeFileSync('assets/catalog/manifest.json',JSON.stringify(report,null,2));writeFileSync('.catalog-build/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
