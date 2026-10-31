/** Rebuild the fictional, downloadable PayPal-style sample from the deterministic demo. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { demoTransactions } from '../lib/demo';
const header=['Date','Time','TimeZone','Name','Type','Status','Currency','Gross','Fee','Net','From Email Address','Transaction ID','Item Title','Invoice Number','Country','Quantity'];
const quote=(v:unknown)=>{const s=String(v??'');return /[",\r\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};
const rows=demoTransactions().map(t=>[t.date,'12:00:00','UTC',t.buyer_key?'Sample Buyer':'',t.kind==='sale'?'Payment Received':t.kind==='refund'?'Refund':'Invoice',t.status,t.currency,t.gross.toFixed(2),(-t.fee).toFixed(2),t.net.toFixed(2),t.buyer_key?`${t.buyer_key}@example.com`:'',t.id,t.item_title||t.item_group||'',t.invoice_id||'',t.country||'',t.quantity??1]);
writeFileSync(resolve(process.cwd(),'public/sample-paypal-activity.csv'),[header,...rows].map(r=>r.map(quote).join(',')).join('\n')+'\n');
