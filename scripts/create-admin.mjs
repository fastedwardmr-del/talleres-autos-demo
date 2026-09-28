import {writeFile} from 'node:fs/promises';
import {passwordRecord} from '../backend/cloud/passwords.js';
// Reads the password from stdin. Produces SQL only; never connects to D1.
const [userId,name,output]=process.argv.slice(2);
if(!/^[a-z0-9_-]{1,100}$/.test(userId||'')||!name?.trim()||name.length>100||!output)throw new Error('Uso: contraseña por stdin | node scripts/create-admin.mjs usuario "Nombre" ruta-segura.sql');
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>2048)throw new Error('Entrada demasiado larga.');}
const record=await passwordRecord(input.replace(/\r?\n$/,''));input='';
const sql=s=>"'"+s.replaceAll("'","''")+"'";
await writeFile(output,`-- Credencial derivada. Guardar fuera del repositorio; aplicar tras 0004.\nINSERT INTO users(company_id,user_id,name,role) VALUES('demo',${sql(userId)},${sql(name)},'ADMIN');\nINSERT INTO user_credentials(company_id,user_id,password_hash,password_salt,password_iterations) VALUES('demo',${sql(userId)},${sql(record.password_hash)},${sql(record.password_salt)},${record.password_iterations});\n`,{flag:'wx',mode:0o600});
console.log('SQL de alta generado. No se ejecutó ninguna migración ni conexión remota.');
