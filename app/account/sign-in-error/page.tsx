import type {Metadata} from 'next';
import Link from 'next/link';
import BrandLogo from '../../../components/brand-logo';
import ProductFooter from '../../../components/product-footer';
import '../../workspace.css';

export const metadata:Metadata={
 title:'Sign-in help | Will This Ever Scale',
 alternates:{canonical:'/account/sign-in-error'},
 robots:{index:false,follow:false},
 referrer:'no-referrer',
};

export default function SignInErrorPage(){
 return <><main className="ws-page">
  <header className="ws-header"><div data-analytics-id="nav_home"><BrandLogo/></div></header>
  <div className="ws-wrap" style={{maxWidth:560}}>
   <div className="ws-heading"><div><span className="ws-eyebrow">YOUR ACCOUNT</span><h1>Sign-in didn’t finish.</h1><p>Start a fresh sign-in to try again.</p></div></div>
   <div className="ws-actions">
    <a className="ws-primary" href="/api/account/login" data-analytics-id="account_signin">Try signing in again</a>
    <Link className="ws-secondary" href="/workspace" data-analytics-id="nav_workspace">Back to workspace</Link>
   </div>
  </div>
 </main><ProductFooter/></>;
}
