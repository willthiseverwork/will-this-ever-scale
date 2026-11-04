import {Suspense} from 'react';
import ScaleTool from '../../components/scale-tool';
export const metadata={title:'Your plan | Will This Ever Scale',description:'Review the findings and next steps from your results.',alternates:{canonical:'/plan'},robots:{index:false,follow:false}};
export default function PlanPage(){return <Suspense fallback={null}><ScaleTool/></Suspense>}
