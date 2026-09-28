// Search normalization only: displayed names are preserved.
export const catalogSearch = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function explicitYears(start,end){
 if(!Number.isInteger(start)||start<1886||start>2100)return [];
 if(end===null||end===undefined)return [start];
 if(!Number.isInteger(end)||end<start||end>2100)throw new Error('Rango de años inválido');
 return Array.from({length:end-start+1},(_,i)=>start+i);
}
