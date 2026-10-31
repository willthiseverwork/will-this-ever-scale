import ProductFooter from '../../components/product-footer';
import '../workspace.css';
import BillingSettings from '../../components/billing-settings';
export const metadata={title:'Plan & billing | Will This Ever Scale',alternates:{canonical:'/billing'},robots:{index:false,follow:false}};
export default function Page(){return <><BillingSettings/><ProductFooter/></>;}
