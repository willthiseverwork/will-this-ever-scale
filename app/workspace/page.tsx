import {billingEnabled,billingLaunchAt} from '../../lib/billing';
import ProductFooter from '../../components/product-footer';
import '../workspace.css';
import WorkspaceDashboard from '../../components/workspace-dashboard';
export const metadata={title:'Workspace | Will This Ever Scale',alternates:{canonical:'/workspace'},robots:{index:false,follow:false}};
export default function WorkspacePage(){return <><WorkspaceDashboard billingActive={billingEnabled()} billingStartsAt={billingLaunchAt()} accountDeletionAvailable={process.env.WTES_ACCOUNT_DELETION_ENABLED==='true'&&!!process.env.WTES_WORKOS_DELETION_API_KEY&&process.env.WTES_BILLING_ENABLED!=='true'}/><ProductFooter/></>}
