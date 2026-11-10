import history from '../fixtures/hobby-shops/demo-history.json';
const catalog=new Set([...history.flatMap(row=>[row.item_title,...(row.cart_items||[]).map(item=>item.name)]), 'Stud earrings','Silver hoops','Stacking rings','Necklaces','Jewelry bundle'].filter((x):x is string=>typeof x==='string').map(x=>x.trim().toLowerCase()));
/** Filter the demo merchant's provider records before any grouping or analysis. */
export function filterDemoTransactions(raw:any[]):any[]{
 const excluded=new Set<string>(),allowed=new Set<string>();
 const bad=(t:any)=>{const items=t?.cart_info?.item_details;return !Array.isArray(items)||!items.length||items.some((item:any)=>typeof item?.item_name!=='string'||!catalog.has(item.item_name.trim().toLowerCase()));};
 for(const t of raw){const i=t?.transaction_info||{};if(Number(i.transaction_amount?.value)>0&&i.transaction_id)(bad(t)?excluded:allowed).add(i.transaction_id);}
 return raw.filter(t=>{const i=t?.transaction_info||{},amount=Number(i.transaction_amount?.value);if(amount>0&&bad(t))return false;if(amount<0&&['T1107','T1115','T1120','T1106','T1201'].includes(i.transaction_event_code)){const ref=i.paypal_reference_id||i.reference_id;if(excluded.has(ref))return false;const items=t?.cart_info?.item_details;if(Array.isArray(items)&&items.length)return !bad(t);return allowed.has(ref);}return true;});
}

/** Ordinary connected merchants retain their unfiltered provider records. */
export function transactionsForShop(raw:any[],isDemoSeller:boolean):any[]{return isDemoSeller?filterDemoTransactions(raw):raw;}
