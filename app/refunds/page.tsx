import type {Metadata} from 'next';
import BrandLogo from '../../components/brand-logo';
import ProductFooter from '../../components/product-footer';

export const metadata:Metadata={title:'Refund policy | Will This Ever Scale',description:'The refund policy for Will This Ever Scale subscriptions.',alternates:{canonical:'/refunds'}};

export default function Refunds(){return <><header className="app-header"><BrandLogo/></header><main className="screen"><div className="wrap questions"><h1>Refund policy</h1><p>Updated 1 November 2026.</p><p>You can request a full refund within 14 days of any charge, including a subscription renewal.</p><p>Contact <a href="mailto:support@willthiseverwork.com">support@willthiseverwork.com</a> or use the refund support route in your Paddle receipt. Mandatory consumer rights still apply.</p><p>For the trial, monthly renewal and cancellation terms, see <a href="/terms" data-analytics-id="terms_link">Terms</a>.</p></div></main><ProductFooter/></>}
