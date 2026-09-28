// Workers WebCrypto supports PBKDF2 up to 100,000 iterations per derivation.
// Versioned per credential so the work factor can be upgraded later.
export const PASSWORD_ITERATIONS=100000;
const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
export async function derivePassword(password,salt,iterations=PASSWORD_ITERATIONS){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256));
}
export async function passwordRecord(password){
 if(typeof password!=='string'||password.length<12||password.length>200)throw Object.assign(new Error('La contraseña debe tener entre 12 y 200 caracteres.'),{code:'VALIDATION',status:400});
 const salt=hex(crypto.getRandomValues(new Uint8Array(24)));
 return {password_hash:await derivePassword(password,salt),password_salt:salt,password_iterations:PASSWORD_ITERATIONS};
}
