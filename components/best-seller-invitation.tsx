import {toMinor,currencyScale} from '../lib/partial-money';
import type {itemCostCohort} from '../lib/item-cost-cohort';
/** A hypothetical comparison is valid only for a complete one-item order cohort. */
export function BestSellerInvitation({cohort,currency}:{cohort:ReturnType<typeof itemCostCohort>;currency:string}){
 if(!cohort?.singleItemOrders||cohort.orders<1||cohort.gross<=0)return <p>These orders may include other items or have incomplete item details. Check the costs for this item to see what is known.</p>;
 const raw=cohort.gross/cohort.orders,per=toMinor(raw,currency)/currencyScale(currency),hypothetical=Math.ceil(raw*1.3/5)*5,shortfall=(toMinor(hypothetical,currency)-toMinor(per,currency))/currencyScale(currency),format=(value:number)=>new Intl.NumberFormat(currency==='GBP'?'en-GB':'en-US',{style:'currency',currency}).format(value);
 return <><p>These orders brought in {format(per)} per order on average, before fees and costs.</p><p>For example, if making or buying and posting an order cost {format(hypothetical)}, that would be {format(shortfall)} more than the amount received, before PayPal fees. Actual buying or materials, postage, time and other costs are not yet known.</p></>;
}
