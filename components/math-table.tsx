'use client';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
ModuleRegistry.registerModules([AllCommunityModule]);
export default function MathTable({rows}:{rows:Record<string,unknown>[]}) {
 const labels:Record<string,string>={id:'Invoice',date:'Issued',status:'Status',currency:'Currency',amount:'Unpaid amount',age_days:'Days unpaid',month:'Month',cameIn:'Came in',fees:'PayPal fees',refunds:'Refunds',costs:'Item costs',ads:'Ad spend',kept:'You kept',name:'Item group',gross:'Sales',orders:'Orders'};
 const monetary=new Set(['cameIn','fees','refunds','costs','ads','kept','gross','amount']);
 const columns=Object.keys(rows[0]||{}).map(field=>({field,headerName:labels[field]||field.replaceAll('_',' '),minWidth:140,flex:1,...(monetary.has(field)?{valueFormatter:({value}:{value:unknown})=>typeof value==='number'?value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):''}:{})}));
 return <div style={{height:360}}><AgGridReact theme={themeQuartz} rowData={rows} columnDefs={columns} defaultColDef={{sortable:true,resizable:true,filter:true}} /></div>;
}
