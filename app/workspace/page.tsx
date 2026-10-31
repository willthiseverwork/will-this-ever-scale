import ProductFooter from '../../components/product-footer';
import '../workspace.css';
import WorkspaceDashboard from '../../components/workspace-dashboard';
export const metadata={title:'Workspace | Will This Ever Scale',alternates:{canonical:'/workspace'},robots:{index:false,follow:false}};
export default function WorkspacePage(){return <><WorkspaceDashboard/><ProductFooter/></>}
