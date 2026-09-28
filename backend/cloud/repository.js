import {entities,childTables,cleanRecord,stateDiff} from './model.js';

export function statement(sql,...values){return {sql,values};}
const insert=(table,row)=>statement(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(()=>'?').join(',')}) ON CONFLICT(company_id,id) DO UPDATE SET ${Object.keys(row).filter(k=>!['company_id','id'].includes(k)).map(k=>`${k}=excluded.${k}`).join(',')}`,...Object.values(row));
const child=(table,company,parentKey,parent,values)=>values.map((value,i)=>insert(table,{company_id:company,id:`${parent}:${i}`, [parentKey]:parent,position:i,payload:JSON.stringify(value)}));
export function writeEntity(company,type,value,position=0){const definition=entities[type],record=cleanRecord(value,definition.omit);const row={company_id:company,id:value.id,position,payload:JSON.stringify(record)};for(const [from,to] of Object.entries(definition.columns))row[to]=value[from]??null;if(['quotes','sales'].includes(type)){row.vehicle_id||=null;row.customer_id||=null;if(type==='quotes')row.work_order_id||=null;}const out=[insert(definition.table,row)];
 const replace=(table,key,parent,values)=>{out.push(statement(`DELETE FROM ${table} WHERE company_id=? AND ${key}=?`,company,parent),...child(table,company,key,parent,values));};
 if(type==='vehicles'){replace('reminders','vehicle_id',value.id,value.reminders||[]);replace('vehicle_documents','vehicle_id',value.id,value.documents||[]);replace('vehicle_photos','vehicle_id',value.id,(value.photos||[]).map(p=>({fileId:p.fileId,label:p.label})));}
 if(type==='orders'){replace('work_order_items','work_order_id',value.id,value.items||[]);replace('vehicle_history','work_order_id',value.id,value.events||[]);out.push(insert('receptions',{company_id:company,id:value.id,work_order_id:value.id,position:0,payload:JSON.stringify(cleanRecord(value.inspection||{},['photos']))}));replace('reception_photos','reception_id',value.id,(value.inspection?.photos||[]).map(p=>({fileId:p.fileId,label:p.label})));}
 if(type==='quotes')replace('quote_items','quote_id',value.id,value.items||[]);
 if(type==='sales')replace('sale_items','sale_id',value.id,value.items||[]);
 return out;
}
export function writeCash(company,cash){const out=[statement('DELETE FROM cash_sessions WHERE company_id=?',company)];const rows=[{...cash,id:'current',history:undefined},...cash.history];rows.forEach((r,i)=>{out.push(insert('cash_sessions',{company_id:company,id:r.id,position:i,payload:JSON.stringify(cleanRecord(r,['movements','history']))}),...child('cash_movements',company,'cash_session_id',r.id,r.movements||[]));});return out;}
export function writeChanges(company,before,after){const out=[],changes=stateDiff(before,after),removePriority={sales:10,appointments:20,quotes:30,orders:40,vehicles:50,clients:60};changes.sort((a,b)=>(a.remove?removePriority[a.type]??45:0)-(b.remove?removePriority[b.type]??45:0));for(const change of changes){if(change.type==='settings'){out.push(statement('UPDATE companies SET settings_json=? WHERE company_id=?',JSON.stringify(after.settings),company));continue;}if(change.type==='cash'){out.push(...writeCash(company,after.cash));continue;}if(change.remove)out.push(statement(`DELETE FROM ${entities[change.type].table} WHERE company_id=? AND id=?`,company,change.id));else out.push(...writeEntity(company,change.type,change.value,after[change.type].findIndex(r=>r.id===change.value.id)));}for(const [type,def] of Object.entries(entities)){if(JSON.stringify(before[type].map(r=>r.id))!==JSON.stringify(after[type].map(r=>r.id)))out.push(statement(`UPDATE ${def.table} SET position=(SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE value=${def.table}.id) WHERE company_id=?`,JSON.stringify(after[type].map(r=>r.id)),company));}return out;}
export const prepared=(db,stmts)=>stmts.map(s=>db.prepare(s.sql).bind(...s.values));
export async function loadState(db,company){
 const childKeys={receptions:'work_order_id',work_order_items:'work_order_id',vehicle_history:'work_order_id',quote_items:'quote_id',sale_items:'sale_id',reminders:'vehicle_id',vehicle_documents:'vehicle_id',vehicle_photos:'vehicle_id',reception_photos:'reception_id',cash_movements:'cash_session_id'};
 const names=[...Object.values(entities).map(d=>d.table),...childTables];
 // Small UNION groups respect D1 compound-select limits; one batch keeps a consistent snapshot.
 const queries=["SELECT 'companies' AS kind,json_object('revision',revision,'settings_json',settings_json) AS value FROM companies WHERE company_id=?",...names.map(t=>`SELECT '${t}' AS kind,json_object('id',id,'position',position,'payload',payload${childKeys[t]?",'"+childKeys[t]+"',"+childKeys[t]:''}) AS value FROM ${t} WHERE company_id=?`)];
 const groups=[];for(let i=0;i<queries.length;i+=5){const part=queries.slice(i,i+5);groups.push(db.prepare(part.join(' UNION ALL ')).bind(...part.map(()=>company)));}const results=(await db.batch(groups)).flatMap(r=>r.results);
 const companyRow=results.find(r=>r.kind==='companies');if(!companyRow)throw Object.assign(new Error('Taller no encontrado.'),{status:404,code:'NOT_FOUND'});const c=JSON.parse(companyRow.value);
 const tables=Object.fromEntries(names.map(n=>[n,results.filter(r=>r.kind===n).map(r=>JSON.parse(r.value)).sort((a,b)=>a.position-b.position)]));const state={version:1,schemaVersion:2,company_id:company,settings:JSON.parse(c.settings_json)};
 for(const [key,d] of Object.entries(entities))state[key]=tables[d.table].map(r=>({...JSON.parse(r.payload),company_id:company}));
 const children=(table,key,id)=>tables[table].filter(r=>r[key]===id).map(r=>JSON.parse(r.payload));
 for(const v of state.vehicles){v.reminders=children('reminders','vehicle_id',v.id);v.documents=children('vehicle_documents','vehicle_id',v.id);v.photos=children('vehicle_photos','vehicle_id',v.id);}
 for(const o of state.orders){o.items=children('work_order_items','work_order_id',o.id);o.events=children('vehicle_history','work_order_id',o.id);o.inspection=children('receptions','work_order_id',o.id)[0]||{};o.inspection.photos=children('reception_photos','reception_id',o.id);}
 for(const q of state.quotes)q.items=children('quote_items','quote_id',q.id);
 for(const s of state.sales)s.items=children('sale_items','sale_id',s.id);
 const cash=tables.cash_sessions.map(r=>({...JSON.parse(r.payload),movements:children('cash_movements','cash_session_id',r.id)}));state.cash={...(cash.find(r=>r.id==='current')||{open:false,initial:0,openedAt:'',movements:[]}),history:cash.filter(r=>r.id!=='current')};delete state.cash.id;
 return {state,revision:c.revision};
}
export async function commitState(db,company,before,after,revision,requestId,result={},extraStatements=[]){
 const done=await db.prepare('SELECT result_json FROM request_receipts WHERE company_id=? AND id=?').bind(company,requestId).first();if(done)return {result:JSON.parse(done.result_json),objectKeys:[]};
 const afterVehicleIds=new Set(after.vehicles.map(v=>v.id)),afterOrderIds=new Set(after.orders.map(o=>o.id));
 const removedVehicleIds=before.vehicles.filter(v=>!afterVehicleIds.has(v.id)).map(v=>v.id);
 const removedOrderIds=before.orders.filter(o=>!afterOrderIds.has(o.id)&&!removedVehicleIds.includes(o.vehicleId)).map(o=>o.id);
 const fileQueries=[...removedVehicleIds.map(id=>db.prepare('SELECT object_key FROM files WHERE company_id=? AND vehicle_id=?').bind(company,id)),...removedOrderIds.map(id=>db.prepare('SELECT object_key FROM files WHERE company_id=? AND reception_id=?').bind(company,id))];
 const fileRows=fileQueries.length?(await db.batch(fileQueries)).flatMap(r=>r.results||[]):[];
 const fileDeletes=[...removedVehicleIds.map(id=>statement('DELETE FROM files WHERE company_id=? AND vehicle_id=?',company,id)),...removedOrderIds.map(id=>statement('DELETE FROM files WHERE company_id=? AND reception_id=?',company,id))];
 const stmts=[statement('INSERT INTO request_receipts(company_id,id,expected_revision,result_json) VALUES(?,?,?,?)',company,requestId,revision,JSON.stringify(result)),...fileDeletes,...before.orders.filter(o=>!after.orders.some(n=>n.id===o.id)||removedVehicleIds.includes(o.vehicleId)).map(o=>statement('DELETE FROM work_order_assignments WHERE company_id=? AND work_order_id=?',company,o.id)),...writeChanges(company,before,after),...extraStatements,...after.orders.flatMap(o=>(o.inspection?.photos||[]).map(p=>statement('UPDATE files SET reception_id=? WHERE company_id=? AND id=? AND reception_id IS NULL',o.id,company,p.fileId))),statement('UPDATE companies SET revision=revision+1 WHERE company_id=?',company)];
 try{await db.batch(prepared(db,stmts));}catch(error){if(String(error).includes('REVISION_CONFLICT'))throw Object.assign(new Error('Otro dispositivo actualizó los datos. Actualiza y vuelve a intentarlo.'),{status:409,code:'CONFLICT'});throw error;}return {result,objectKeys:fileRows.map(x=>x.object_key).filter(Boolean)};
}

export async function cleanOperationalData(db,company,revision,requestId){
 const done=await db.prepare('SELECT result_json FROM request_receipts WHERE company_id=? AND id=?').bind(company,requestId).first();
 if(done)return {result:JSON.parse(done.result_json),objectKeys:[]};
 const files=await db.prepare('SELECT object_key FROM files WHERE company_id=?').bind(company).all();
 const result={cleaned:true};
 const stmts=[
  statement('INSERT INTO request_receipts(company_id,id,expected_revision,result_json) VALUES(?,?,?,?)',company,requestId,revision,JSON.stringify(result)),
  statement('DELETE FROM files WHERE company_id=?',company),
  statement('DELETE FROM cash_sessions WHERE company_id=?',company),
  statement('DELETE FROM inventory_movements WHERE company_id=?',company),
  statement('DELETE FROM activity WHERE company_id=?',company),
  statement('DELETE FROM sales WHERE company_id=?',company),
  statement('DELETE FROM appointments WHERE company_id=?',company),
  statement('DELETE FROM quotes WHERE company_id=?',company),
  statement('DELETE FROM work_order_assignments WHERE company_id=?',company),
  statement('DELETE FROM work_orders WHERE company_id=?',company),
  statement('DELETE FROM vehicles WHERE company_id=?',company),
  statement('DELETE FROM customers WHERE company_id=?',company),
  statement('UPDATE companies SET revision=revision+1 WHERE company_id=?',company)
 ];
 try{await db.batch(prepared(db,stmts));}catch(error){if(String(error).includes('REVISION_CONFLICT'))throw Object.assign(new Error('Otro dispositivo actualizó los datos. Actualiza y vuelve a intentarlo.'),{status:409,code:'CONFLICT'});throw error;}
 return {result,objectKeys:(files.results||[]).map(x=>x.object_key).filter(Boolean)};
}
