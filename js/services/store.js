import {DemoStore} from './localStore.js';
import {ApiStore} from './apiStore.js';
import {runtime} from '../runtime-config.js';
export {DemoStore,uid,totals} from './localStore.js';
export const store=runtime.dataMode==='api'?new ApiStore():new DemoStore(globalThis.localStorage||{getItem:()=>null,setItem:()=>{}});
store.mode=runtime.dataMode;
