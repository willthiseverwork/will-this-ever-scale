import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTransactions} from '../lib/paypal';
test('PayPal cart line items retain valid quantity and same-currency unit prices',()=>{
 const rows=normalizeTransactions([{transaction_info:{transaction_id:'T1',transaction_initiation_date:'2026-10-01',transaction_amount:{currency_code:'GBP',value:'30'},fee_amount:{value:'-1'},transaction_event_code:'T0000',transaction_status:'S'},cart_info:{item_details:[{item_name:'A',item_quantity:'1',item_unit_price:{currency_code:'GBP',value:'20'}},{item_name:'B',item_quantity:'2',item_unit_price:{currency_code:'GBP',value:'5'}}]}}]);
 assert.deepEqual(rows[0].cart_items,[{name:'A',quantity:1,unit_price:20},{name:'B',quantity:2,unit_price:5}]);
 const incomplete=normalizeTransactions([{transaction_info:{transaction_id:'T2',transaction_initiation_date:'2026-10-01',transaction_amount:{currency_code:'GBP',value:'30'},transaction_event_code:'T0000',transaction_status:'S'},cart_info:{item_details:[{item_name:'A',item_quantity:'1',item_unit_price:{currency_code:'GBP',value:'20'}},{item_name:'B',item_quantity:'1',item_unit_price:{currency_code:'USD',value:'10'}}]}}]);assert.equal(incomplete[0].cart_items,undefined);
});
