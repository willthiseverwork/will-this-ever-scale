type DemoRead={at:string;ok:boolean;stage?:string;code?:string;orders?:number};
const state=globalThis as typeof globalThis & {__wtesLastDemoRead?:DemoRead};
export function recordDemoRead(read:DemoRead){state.__wtesLastDemoRead=read;}
export function getDemoRead(){return state.__wtesLastDemoRead??null;}
