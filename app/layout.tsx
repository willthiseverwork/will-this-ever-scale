import type { Metadata, Viewport } from 'next';
import { PRODUCT_NAME } from '../lib/brand';
import Analytics from '../components/analytics';
import './globals.css';
import './brand-logo.css';
const origin='https://app.willthiseverscale.com';
export const metadata:Metadata={metadataBase:new URL(origin),title:PRODUCT_NAME,description:'See where your PayPal money comes in, where it goes, and what to test next.',alternates:{canonical:'/'},openGraph:{title:PRODUCT_NAME,description:'See where your PayPal money goes and what to test next.',url:origin,type:'website'},twitter:{card:'summary'},icons:{icon:[{url:'/favicon.svg',type:'image/svg+xml'},{url:'/favicon-32.png',sizes:'32x32',type:'image/png'}],apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]}};
export const viewport:Viewport={themeColor:'#08090a'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:PRODUCT_NAME,url:origin})}}/>{children}<Analytics/></body></html>}
