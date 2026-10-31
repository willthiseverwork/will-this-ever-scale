import type { Metadata } from 'next'; import { PRODUCT_NAME } from '../lib/brand'; import './globals.css';
export const metadata:Metadata={title:PRODUCT_NAME,description:'See where your PayPal money comes in, leaks out and what to test next.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
