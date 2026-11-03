import {Suspense} from 'react';
import ScaleTool from '../../components/scale-tool';
export const metadata={title:'Your results | Will This Ever Scale',alternates:{canonical:'/read'},robots:{index:false,follow:false}};
export default function ReadPage(){return <Suspense fallback={null}><ScaleTool/></Suspense>}
