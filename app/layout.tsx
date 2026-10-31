import type { Metadata } from 'next';
import { PRODUCT_NAME } from '../lib/brand';
import Analytics from '../components/analytics';
import './globals.css';
const origin='https://app.willthiseverscale.com';
export const metadata:Metadata={metadataBase:new URL(origin),title:PRODUCT_NAME,description:'See where your PayPal money comes in, where it goes, and what to test next.',alternates:{canonical:'/'},openGraph:{title:PRODUCT_NAME,description:'See where your PayPal money goes and what to test next.',url:origin,type:'website'},twitter:{card:'summary'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:PRODUCT_NAME,url:origin})}}/>{children}<Analytics/></body></html>}
