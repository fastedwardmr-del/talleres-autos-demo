import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export class SQLiteD1{
 constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec(readFileSync('schema.sql','utf8'));}
 prepare(sql){if((sql.match(/UNION ALL/g)||[]).length>=5)throw new Error('D1 compound SELECT limit');const db=this.sqlite;let values=[];return {bind(...v){values=v;return this;},async all(){return {results:db.prepare(sql).all(...values)};},async first(){return db.prepare(sql).get(...values)||null;},async run(){const result=db.prepare(sql).run(...values);return {success:true,meta:{changes:result.changes}};},execute(){const stmt=db.prepare(sql);return {success:true,results:stmt.columns().length?stmt.all(...values):(stmt.run(...values),[])};}};}
 async batch(statements){this.sqlite.exec('BEGIN');try{const results=statements.map(s=>s.execute());this.sqlite.exec('COMMIT');return results;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
}
export class MemoryR2{constructor(){this.objects=new Map();}async put(key,body,options){this.objects.set(key,{body:new Uint8Array(body),options});}async get(key){const v=this.objects.get(key);return v?{body:v.body}:null;}async delete(key){this.objects.delete(key);}}
