import {createHmac} from 'node:crypto';import type {Txn} from './types';import {quietRegulars} from './quiet-offer';
/** Only quiet contacts are returned, for this response; no contact is logged or stored. */
export function sandboxQuietContacts(raw:any[],history:Array<Txn&{buyer_email?:string}>,rows:Txn[],salt:Buffer){
 const quiet=new Set(quietRegulars(rows).map(x=>x.key)),contacts=new Map<string,{key:string;name:string;email:string}>();
 for(const transaction of raw){const payer=transaction?.payer_info,id=payer?.account_id;if(typeof id!=='string'||!id)continue;const key=createHmac('sha256',salt).update(id).digest('hex');if(!quiet.has(key))continue;const rawName=payer?.payer_name?.given_name||payer?.payer_name?.alternate_full_name;const name=typeof rawName==='string'?rawName.trim().split(/\s+/)[0]:'';const email=payer?.email_address;if(name&&typeof email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))contacts.set(key,{key,name,email})}
 for(const row of history){if(!row.buyer_key||!quiet.has(row.buyer_key)||!row.buyer_name||!row.buyer_email)continue;contacts.set(row.buyer_key,{key:row.buyer_key,name:row.buyer_name,email:row.buyer_email})}
 return [...contacts.values()];
}
