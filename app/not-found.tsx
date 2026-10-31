import Link from 'next/link';
import BrandLogo from '../components/brand-logo';
export default function NotFound(){return <><header className="app-header"><BrandLogo/></header><main className="screen"><div className="wrap questions"><h1>That page isn’t here.</h1><p className="intro">Try your read again from the start.</p><Link className="button" href="/">Back to the tool</Link></div></main></>}
