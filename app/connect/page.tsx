import ProductFooter from '../../components/product-footer';
import type {Metadata} from 'next';
import '../workspace.css';
import ConnectInfo from '../../components/connect-info';
export const metadata:Metadata={title:'Connect | Will This Ever Scale',description:'Use the sample connector or analyze a PayPal CSV.',alternates:{canonical:'/connect'},robots:{index:false,follow:false}};
export default function ConnectPage(){return <><ConnectInfo/><ProductFooter/></>;}
