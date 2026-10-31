import ProductFooter from '../../components/product-footer';
import '../workspace.css';
import BillingSettings from '../../components/billing-settings';
export const metadata={title:'Billing',robots:{index:false,follow:false}};
export default function Page(){return <><BillingSettings/><ProductFooter/></>;}
