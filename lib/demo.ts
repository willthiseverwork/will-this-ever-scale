import type { Txn } from './types';
export const DEMO_AS_OF='2026-10-31T12:00:00Z';
export function demoTransactions():Txn[] {
  const out:Txn[]=[], previous:string[][]=[];let id=0;
  for(let mi=0;mi<12;mi++){
    const buyers:string[]=[], count=[100,100,78,72,68,72,78,86,91,99,110,94][mi], repeat=mi===0?0:mi<7?13:7;
    for(let j=0;j<count;j++){
      const buyer=j<repeat?previous[mi-1][previous[mi-1].length-1-j]:`buyer-${mi}-${j}`;buyers.push(buyer);
      const group=j<count*.20?'Stud earrings':j<count*.66?'Silver hoops':j<count*.97?'Stacking rings':'Necklaces';const pair=j>=19&&j<22;const held=mi===11&&j>=22&&j<28;const price=pair?35:held?35:group==='Stud earrings'?5:group==='Silver hoops'?30:group==='Stacking rings'?30:55;const fee=Math.round((price*.0349+.49+(j<count*.35?price*.015:0))*100)/100;
      const date=new Date(Date.UTC(2025,10+mi,held?j:1+j%27)).toISOString().slice(0,10);
      const cart_items=pair?[{name:'Silver hoops',quantity:1,unit_price:30},{name:'Stud earrings',quantity:1,unit_price:5}]:[{name:group,quantity:1,unit_price:price}];
      out.push({id:`sale-${++id}`,date,kind:'sale',gross:price,fee,net:price-fee,currency:'USD',buyer_key:buyer,item_title:group,item_group:group,country:j<count*.35?'CA':'US',status:'Completed',fee_known:true,cart_complete:true,quantity:1,quantity_known:true,cart_items,...(held?{hold_confirmed:true,tracking_present:false}:{})});
      if(group==='Stacking rings'&&j<Math.ceil(count*.66)+(mi>=9?5:3))out.push({id:`refund-${id}`,date,kind:'refund',gross:-price,fee:0,net:-price,currency:'USD',reference_id:`sale-${id}`,item_group:group,status:'Refunded'});
    }previous.push(buyers);
  }
  // Titles read back from the three mapped PayPal sandbox invoices on 31 Oct 2026.
  for(let i=0;i<3;i++)out.push({id:`invoice-${i}`,date:`2026-10-0${i+1}`,kind:'other',gross:180,fee:0,net:180,currency:'USD',invoice_id:`INV-${i}`,item_title:'Jewelry order',status:'Unpaid'});
  return out;
}

/** Fictional names are for the bundled sample only. */
export function demoBuyerName(key:string){const names=['Maya','Ella','Sofia','Leah','Nina','Chloe','Amara','Ruby','Mila','Ava','Zoe','Iris','Hannah','Lily','Tara','Aisha'];let hash=0;for(const c of key)hash=(hash*31+c.charCodeAt(0))>>>0;return names[hash%names.length]}
