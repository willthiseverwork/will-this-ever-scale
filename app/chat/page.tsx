import ProductFooter from '../../components/product-footer';
import '../workspace.css';
import DataChat from '../../components/data-chat';
export const metadata={title:'Ask your data | Will This Ever Scale',alternates:{canonical:'/chat'},robots:{index:false,follow:false}};
export default function ChatPage(){return <><DataChat/><ProductFooter/></>}
