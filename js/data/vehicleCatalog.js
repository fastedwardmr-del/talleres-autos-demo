// Catálogo demostrativo orientado a modelos conocidos en Colombia. No homologación.
// Versiones y años son muestras para la UI. Especificaciones no verificadas quedan vacías.
const definitions = {
 Mazda:[['Mazda 2','Automóvil','Hatchback',2018,['Touring','Grand Touring']],['Mazda 3','Automóvil','Sedán',2018,['Touring','Grand Touring']],['CX-30','SUV','SUV',2020,['Touring','Grand Touring']],['CX-5','SUV','SUV',2018,['Touring','Grand Touring']]],
 Toyota:[['Corolla','Automóvil','Sedán',2018,['XEi','SEG']],['Hilux','Camioneta','Pickup',2018,['SR','SRV']],['Fortuner','SUV','SUV',2018,['SR5','SRV']],['Yaris','Automóvil','Hatchback',2018,['XS','XLS']],['RAV4','SUV','SUV',2019,['XLE','Limited']]],
 Chevrolet:[['Onix','Automóvil','Sedán',2020,['LT','Premier']],['Tracker','SUV','SUV',2020,['LT','Premier']],['Captiva','SUV','SUV',2020,['LT','Premier']],['Spark','Automóvil','Hatchback',2018,['Life','GT']],['NHR','Comercial','Camión',2018,['Chasis cabina','Furgón']]],
 Renault:[['Logan','Automóvil','Sedán',2018,['Life','Intens']],['Sandero','Automóvil','Hatchback',2018,['Life','Intens']],['Duster','SUV','SUV',2018,['Zen','Intens']],['Kwid','Automóvil','Hatchback',2020,['Zen','Intens']],['Stepway','Automóvil','Hatchback',2018,['Zen','Intens']]],
 Kia:[['Picanto','Automóvil','Hatchback',2018,['Vibrant','Zenith']],['Rio','Automóvil','Sedán',2018,['Vibrant','Zenith']],['Sportage','SUV','SUV',2018,['Desire','Emotion']],['Seltos','SUV','SUV',2021,['Vibrant','Zenith']]],
 Nissan:[['March','Automóvil','Hatchback',2018,['Sense','Advance']],['Versa','Automóvil','Sedán',2018,['Sense','Advance']],['Sentra','Automóvil','Sedán',2018,['Advance','Exclusive']],['Frontier','Camioneta','Pickup',2018,['S','LE']],['X-Trail','SUV','SUV',2018,['Sense','Exclusive']]],
 Ford:[['Escape','SUV','SUV',2018,['SE','Titanium']],['Ranger','Camioneta','Pickup',2018,['XLS','XLT']],['Explorer','SUV','SUV',2018,['XLT','Limited']]],
 Volkswagen:[['Polo','Automóvil','Hatchback',2018,['Trendline','Comfortline']],['Gol','Automóvil','Hatchback',2018,['Trendline','Comfortline']],['T-Cross','SUV','SUV',2020,['Trendline','Highline']]],
 Hyundai:[['Tucson','SUV','SUV',2018,['Premium','Limited']],['Accent','Automóvil','Sedán',2018,['GL','GLS']],['Grand i10','Automóvil','Hatchback',2018,['Advance','Premium']]],
 Suzuki:[['Swift','Automóvil','Hatchback',2018,['GL','GLX']],['Vitara','SUV','SUV',2018,['GL','GLX']],['Jimny','SUV','SUV',2019,['GL','GLX']]]
};
export const catalogTypes = ['Automóvil','SUV','Camioneta','Comercial','Motocicleta','Otro'];
export const localCatalog = Object.entries(definitions).flatMap(([make,models]) => models.flatMap(([model,type,bodyType,from,versions]) => Array.from({length:2025-from+1},(_,i)=>from+i).flatMap(year => versions.map((version,index)=>({
 id:`local:${make}:${model}:${year}:${index}`,make,model,type,year,version,bodyType,
 engine:'',displacement:'',fuel:type==='Comercial'?'Diésel':'',transmission:'',drive:'',source:'local',verified:false
})))));
export function canonicalModel(make,model){return make==='Mazda'&&['2','3'].includes(String(model))?`Mazda ${model}`:model;}
export function localCatalogQuery(level,s={}){
 const rows=localCatalog.filter(r=>(!s.type||r.type===s.type)&&(!s.make||r.make===s.make)&&(!s.year||r.year===Number(s.year))&&(!s.model||r.model===canonicalModel(s.make,s.model)));
 const unique=key=>[...new Set(rows.map(r=>r[key]))];
 if(level==='types')return catalogTypes.map(value=>({value,label:value}));
 if(level==='makes')return unique('make').sort().map(value=>({value,label:value}));
 if(level==='years')return unique('year').sort((a,b)=>b-a).map(value=>({value:String(value),label:String(value)}));
 if(level==='models')return unique('model').sort().map(value=>({value,label:value}));
 if(level==='versions')return rows.map(r=>({value:r.id,label:r.version}));
 if(level==='specs')return localCatalog.find(r=>r.id===s.versionId)||null;
 throw new Error('Nivel de catálogo no válido.');
}
