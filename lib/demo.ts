import type { Txn } from './types';
export const DEMO_AS_OF='2026-10-31T12:00:00Z';
export function demoTransactions():Txn[] {
  const out:Txn[]=[], previous:string[][]=[];let id=0;
  for(let mi=0;mi<12;mi++){
    const buyers:string[]=[], count=mi<2?90:80, repeat=mi===0?0:mi<7?13:7;
    for(let j=0;j<count;j++){
      const buyer=j<repeat?previous[mi-1][previous[mi-1].length-1-j]:`buyer-${mi}-${j}`;buyers.push(buyer);
      const group=j<count*.3?'Stud earrings':j<count*.73?'Silver hoops':j<count*.97?'Stacking rings':'Necklaces';const price=group==='Stud earrings'?18:group==='Silver hoops'?28:group==='Stacking rings'?35:55;const fee=Math.round((price*.035+.49)*100)/100;
      const date=new Date(Date.UTC(2025,10+mi,1+j%27)).toISOString().slice(0,10);
      out.push({id:`sale-${++id}`,date,kind:'sale',gross:price,fee,net:price-fee,currency:'USD',buyer_key:buyer,item_title:group,item_group:group,country:j<count*.35?'CA':'US',status:'Completed'});
      if(group==='Stacking rings'&&j<Math.ceil(count*.73)+(mi%2===0?3:2))out.push({id:`refund-${id}`,date,kind:'refund',gross:-price,fee:0,net:-price,currency:'USD',reference_id:`sale-${id}`,item_group:group,status:'Refunded'});
    }previous.push(buyers);
  }
  for(let i=0;i<3;i++)out.push({id:`invoice-${i}`,date:`2026-10-0${i+1}`,kind:'other',gross:180,fee:0,net:180,currency:'USD',invoice_id:`INV-${i}`,status:'Unpaid'});
  return out;
}
