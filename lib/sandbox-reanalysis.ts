import {analyze} from './engine';
import {templateRead} from './read';
import type {Analysis,Inputs,Txn} from './types';

/** Runs only on ephemeral normalized browser rows; no follow-up credential request. */
export function reanalyzeSandboxRows(rows:Txn[],previous:Analysis,inputs:Inputs):Analysis {
 if(!rows.some(row=>['sale','invoice_payment','subscription_payment'].includes(row.kind)&&row.gross>0&&row.status==='completed')){
  const gap='No completed sales are available, so item costs and ads cannot be applied to a sales read.';
  return {...previous,gaps:[...new Set([...(previous.gaps||[]),...(inputs.costPerItem!==undefined||inputs.monthlyAdSpend!==undefined?[gap]:[])])]};
 }
 const result=analyze(rows,{...inputs,...(previous.as_of?{asOf:previous.as_of}:{})});
 result.clock_basis=previous.clock_basis||'seller';
 // Costs and ads cannot change the server-verified action snapshot. In
 // particular, retain its precise invoice timestamps/14-day eligibility rather
 // than letting the generic engine's date normalization promote newer invoices.
 result.invoice_records=previous.invoice_records;
 result.invoice_observations=previous.invoice_observations;
 result.action_findings=previous.action_findings;
 result.quick_win=previous.quick_win;
 const actionIds=new Set(['unpaid_invoices','held_money']);
 const verifiedCards=[...(previous.cards||[]),...(previous.action_findings||[]).flatMap(finding=>finding.card?[finding.card]:[]),...(previous.quick_win?.card?[previous.quick_win.card]:[])].filter(card=>actionIds.has(card.id));
 result.cards=[...(result.cards||[]).filter(card=>!actionIds.has(card.id)),...new Map(verifiedCards.map(card=>[card.id,card])).values()];
 // Read coverage and subscription observations belong to the provider snapshot;
 // local assumptions cannot turn missing provider data into complete coverage.
 const snapshotGaps=(previous.gaps||[]).filter(gap=>!gap.startsWith('Some item costs were not supplied;')&&!gap.startsWith('Ad spend was not supplied;')&&!(rows.some(row=>row.invoice_id)&&gap==='Invoice coverage is unavailable from these transaction records.'));
 result.gaps=[...new Set([...(result.gaps||[]),...snapshotGaps])];
 if(previous.subscriptions)result.subscriptions=previous.subscriptions;
 result.read=templateRead(result);
 return result;
}
