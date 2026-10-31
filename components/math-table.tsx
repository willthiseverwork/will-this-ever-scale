'use client';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
ModuleRegistry.registerModules([AllCommunityModule]);

export default function MathTable({rows, highlight}:{rows:Record<string,string>[];highlight?:string}) {
 const columns=Object.keys(rows[0]||{}).map((field,index)=>({field,headerName:field,flex:field==='Refunded'?2.2:field==='Item'?1.4:1,minWidth:field==='Item'?80:field==='Sales'?52:field==='Share'?44:field==='Refunded'?80:index===0?64:48,...(field==='Item'||field==='Refunded'?{wrapText:true,autoHeight:true}:{}),cellClass:index?'math-number':'math-label',headerClass:index?'math-number-header':''}));
 return <div className="math-grid"><AgGridReact theme={themeQuartz.withParams({backgroundColor:'#0e0f11',foregroundColor:'#c4c6cb',headerTextColor:'#80848c',borderColor:'#1b1d21',fontFamily:'Geist Mono, monospace',fontSize:13,headerFontSize:12,rowBorder:true,wrapperBorder:false,spacing:4})} rowData={rows} columnDefs={columns} defaultColDef={{sortable:false,resizable:false,filter:false,suppressHeaderMenuButton:true}} domLayout="autoHeight" getRowClass={({data})=>highlight&&data?.Month===highlight?'math-highlight':data?.Month==='Total'?'math-total':''}/></div>;
}
