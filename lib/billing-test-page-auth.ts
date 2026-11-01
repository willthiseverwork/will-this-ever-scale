import {session} from './workspace-auth';
import {billingTestAuthorized} from './billing-test-context';
/** Same verified session and exact owner/config gate used by the sandbox API. */
export function canRenderBillingTest(request:Request){const user=session(request);return !!user&&billingTestAuthorized(user.userId);}
