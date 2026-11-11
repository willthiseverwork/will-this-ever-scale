import type {Analysis,Txn} from '../lib/types';
import {bundleOffer} from '../lib/bundle-offer';
import {money} from '../lib/display';
import {shopSellingDescription} from '../lib/product-groups';
import {hasLeadEvidence,leadSummary} from './lead-card';

export default function StartDemoFindings({analysis,rows}:{analysis:Analysis;rows:Txn[]}){
 const top=analysis.ranked_leaks[0];
 const preview=top?.id==='one_time_buyers'&&hasLeadEvidence(top)?leadSummary(analysis,top):null;
 const pair=bundleOffer(rows,analysis.product_grouping,analysis.currency);
 const invoices=analysis.invoice_observations;
 const shop=shopSellingDescription(analysis.product_grouping);const months=analysis.months.filter(m=>(m.orders||0)>0).length;
 return <>{(shop||months>0)&&<p>{shop?`${shop}. `:''}{months>0?`${months} ${months===1?'month':'months'} of PayPal sales.`:''}</p>}{preview&&top?<div className="start-demo-lead"><span className="source-line">Most buyers bought once</span><strong>About +{money(preview.amount,analysis.currency)} <small>{preview.unit}</small></strong><p>{preview.condition.replace(/your /g,'its ')}</p>{Number(top.evidence.returning_buyers)>0&&<p>{Number(top.evidence.returning_buyers)} of its {Number(top.evidence.buyers)} buyers already came back.</p>}</div>:<p>See what this shop found.</p>}{invoices?.unpaid!=null&&invoices.unpaid_total!=null&&<div className="start-demo-row"><span>{invoices.unpaid} people haven’t paid yet</span><span>{money(invoices.unpaid_total,analysis.currency)}</span></div>}{pair&&pair.coBuyers>0&&<div className="start-demo-row"><span>{pair.a} and {pair.b} bought together</span><span>{pair.coBuyers} buyers</span></div>}</>;
}
