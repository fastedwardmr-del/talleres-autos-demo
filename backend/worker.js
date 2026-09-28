// Referencia no desplegada. Añadir autenticación antes de exponerla en producción.
import {handleApi} from './api.js';
export default {fetch(request,env){return handleApi(request,env);}};
