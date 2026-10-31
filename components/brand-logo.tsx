import Link from 'next/link';

export default function BrandLogo(){
  return <Link href="/" className="brand" aria-label="willthiseverscale home"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect width="22" height="22" rx="5" fill="#c8ff4d"/><path d="M5 16h4.4c2.6 0 3.9-1.3 5-3.9L16.5 6.5" fill="none" stroke="#08090a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.6 7.6l2.9-1.4 1.1 3" fill="none" stroke="#08090a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>willthiseverscale</Link>;
}
