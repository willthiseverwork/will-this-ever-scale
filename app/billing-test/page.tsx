import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {canRenderBillingTest} from '../../lib/billing-test-page-auth';
import BillingTest from '../../components/billing-test';
import '../workspace.css';
export const dynamic='force-dynamic';
export const metadata={title:'Payment test',robots:{index:false,follow:false}};
export default async function BillingTestPage(){const incoming=await headers();const request=new Request('https://localhost/',{headers:{cookie:incoming.get('cookie')||''}});if(!canRenderBillingTest(request))notFound();return <BillingTest/>;}
