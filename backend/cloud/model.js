// Tablas/columnas son una lista cerrada, nunca identificadores enviados por HTTP.
export const entities={
 clients:{table:'customers',columns:{name:'name',document:'document'}},
 technicians:{table:'technicians',columns:{name:'name'}},
 products:{table:'products',columns:{sku:'sku',stock:'stock',price:'price'}},
 services:{table:'services',columns:{name:'name',price:'price'}},
 vehicles:{table:'vehicles',columns:{ownerId:'customer_id',plate:'plate_normalized',make:'make',model:'model',year:'year',mileage:'mileage'},omit:['photos','documents','reminders']},
 orders:{table:'work_orders',columns:{vehicleId:'vehicle_id',clientId:'customer_id',technicianId:'technician_id',status:'status',number:'number'},omit:['items','inspection','events']},
 quotes:{table:'quotes',columns:{vehicleId:'vehicle_id',clientId:'customer_id',orderId:'work_order_id',status:'status'},omit:['items']},
 appointments:{table:'appointments',columns:{vehicleId:'vehicle_id',clientId:'customer_id',technicianId:'technician_id',date:'date',time:'time',status:'status'}},
 sales:{table:'sales',columns:{vehicleId:'vehicle_id',clientId:'customer_id',number:'number',method:'method'},omit:['items']},
 movements:{table:'inventory_movements',columns:{productId:'product_id',quantity:'quantity'}},
 activity:{table:'activity',columns:{}}
};
export const childTables=['receptions','work_order_items','vehicle_history','quote_items','sale_items','reminders','vehicle_documents','vehicle_photos','reception_photos','cash_sessions','cash_movements'];
export const jsonCopy=value=>JSON.parse(JSON.stringify(value));
export function cleanRecord(value,omit=[]){const copy=jsonCopy(value);for(const key of omit)delete copy[key];delete copy.company_id;return copy;}
export function stateDiff(before,after){const changes=[];for(const type of Object.keys(entities)){const old=new Map(before[type].map(v=>[v.id,v]));for(const value of after[type]){if(JSON.stringify(value)!==JSON.stringify(old.get(value.id)))changes.push({type,value});old.delete(value.id);}for(const id of old.keys())changes.push({type,id,remove:true});}for(const type of ['cash','settings'])if(JSON.stringify(before[type])!==JSON.stringify(after[type]))changes.push({type,value:after[type]});return changes;}
