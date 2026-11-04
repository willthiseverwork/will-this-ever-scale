import {Suspense} from 'react';
import ScaleTool from '../../../components/scale-tool';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;return {title:'Your finding | Will This Ever Scale',description:'Review a finding and its suggested next steps.',alternates:{canonical:`/leak/${encodeURIComponent(id)}`},robots:{index:false,follow:false}};}
export default function LeakPage(){return <Suspense fallback={null}><ScaleTool/></Suspense>}
