import {mkdirSync,writeFileSync} from 'node:fs';
import {makeSeed} from '../js/data/seed.js';
import {migrateVehicles} from '../js/services/vehicleMigration.js';
import {entities} from '../backend/cloud/model.js';
import {writeEntity,writeCash} from '../backend/cloud/repository.js';
import {validateState} from '../backend/cloud/validation.js';
export function cloudSeed(){const data=migrateVehicles(makeSeed());data.company_id='demo';data.settings.workshop='TallerPro DEMO';data.activity.forEach((v,i)=>v.id=`activity-seed-${i}`);return data;}
export function seedStatements(){const state=cloudSeed();validateState(state,null,{seed:true});const rows=[{sql:'INSERT INTO companies(company_id,name,settings_json) VALUES(?,?,?)',values:['demo','TallerPro DEMO',JSON.stringify(state.settings)]}];for(const [type] of Object.entries(entities))state[type].forEach((r,i)=>rows.push(...writeEntity('demo',type,r,i)));rows.push(...writeCash('demo',state.cash));return rows;}
const sqlValue=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
export function seedSql(){const statements=seedStatements();return '-- Seed exclusivo TallerPro. Idempotente: no actualiza filas existentes.\n'+statements.filter(s=>!s.sql.startsWith('DELETE')).map(s=>{let index=0;let sql=s.sql.split(' ON CONFLICT')[0].replace('INSERT INTO','INSERT OR IGNORE INTO');return sql.replaceAll('?',()=>sqlValue(s.values[index++]))+';';}).join('\n')+"\nINSERT OR IGNORE INTO seed_runs(name) VALUES('v03-demo');\n";}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scripts/seed.mjs')){mkdirSync('seed',{recursive:true});writeFileSync('seed/demo.sql',seedSql());console.log('Seed generado en seed/demo.sql; no se ha enviado a Cloudflare.');}
