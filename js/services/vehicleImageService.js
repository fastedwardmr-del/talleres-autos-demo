import {apiRequest} from './apiClient.js';
export async function findReferenceImage({make,brand,model,year}){if(!(make||brand)||!model||!year)return null;const q=new URLSearchParams({make:make||brand,model,year:String(year)});try{return await apiRequest('/api/vehicle-image?'+q.toString(),{timeout:12000});}catch{return null;}}
