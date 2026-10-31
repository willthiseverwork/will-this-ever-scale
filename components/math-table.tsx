'use client';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
ModuleRegistry.registerModules([AllCommunityModule]);
export default function MathTable({rows}:{rows:Record<string,unknown>[]}) {
 const labels:Record<string,string>={period:'Period',came_in:'Came in',paypal_fees:'PayPal fees',ad_spend:'Ad spend',buyers:'Buyers',new_buyers:'First-time buyers',returning_buyers:'Returning buyers',returning_share:'Share who returned',average_order:'Average order',orders_per_buyer:'Orders per buyer',id:'Invoice',date:'Issued',status:'Status',currency:'Currency',amount:'Unpaid amount',age_days:'Days unpaid',month:'Month',cameIn:'Came in',fees:'PayPal fees',refunds:'Refunds',costs:'Item costs',ads:'Ad spend',kept:'You kept',name:'Item group',gross:'Sales',orders:'Orders'};
 const monetary=new Set(['cameIn','fees','refunds','costs','ads','kept','gross','amount','came_in','paypal_fees','ad_spend','average_order']);
 const columns=Object.keys(rows[0]||{}).map(field=>({field,headerName:labels[field]||field.replaceAll('_',' '),minWidth:140,flex:1,...(monetary.has(field)?{valueFormatter:({value}:{value:unknown})=>typeof value==='number'?value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):''}:{})}));
 return <div style={{height:360}}><AgGridReact theme={themeQuartz} rowData={rows} columnDefs={columns} defaultColDef={{sortable:true,resizable:true,filter:true}} /></div>;
}
