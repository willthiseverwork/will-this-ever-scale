'use client';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
ModuleRegistry.registerModules([AllCommunityModule]);

export default function MathTable({rows, highlight}:{rows:Record<string,string>[];highlight?:string}) {
 const columns=Object.keys(rows[0]||{}).map((field,index)=>({field,headerName:field,flex:1,minWidth:index===0?120:90,cellClass:index?'math-number':'',headerClass:index?'math-number-header':''}));
 return <div className="math-grid"><AgGridReact theme={themeQuartz.withParams({backgroundColor:'#0e0f11',foregroundColor:'#c4c6cb',headerTextColor:'#80848c',borderColor:'#1b1d21',fontFamily:'Geist Mono, monospace',fontSize:13,headerFontSize:12,rowBorder:true,wrapperBorder:false,spacing:4})} rowData={rows} columnDefs={columns} defaultColDef={{sortable:false,resizable:false,filter:false,suppressHeaderMenuButton:true}} domLayout="autoHeight" getRowClass={({data})=>data?.Month===highlight?'math-highlight':data?.Month==='Total'?'math-total':''}/></div>;
}
