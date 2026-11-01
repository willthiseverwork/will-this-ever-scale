import {AsyncLocalStorage} from 'node:async_hooks';
import {createHmac} from 'node:crypto';
import {get,put} from '@vercel/blob';
import {getVercelOidcToken} from '@vercel/oidc';
import {openAction,sealAction} from './action-store';

type Phase='active'|'expired';
export type BillingTestContext={owner:string;apiKey:string;clientToken:string;priceId:string;webhookSecret:string;secret:string;storeId:string;phase:Phase;environment:'sandbox';api:'https://sandbox-api.paddle.com'};
const scope=new AsyncLocalStorage<BillingTestContext>();
export function billingTestConfig(env:Record<string,string|undefined>=process.env):BillingTestContext|null {
 const owner=env.WTES_BILLING_TEST_OWNER_USER_ID,apiKey=env.WTES_BILLING_TEST_PADDLE_API_KEY,clientToken=env.WTES_BILLING_TEST_PADDLE_CLIENT_TOKEN,priceId=env.WTES_BILLING_TEST_PADDLE_PRICE_MONTHLY,webhookSecret=env.WTES_BILLING_TEST_PADDLE_WEBHOOK_SECRET,secret=env.WTES_BILLING_TEST_SECRET,storeId=env.WTES_BILLING_TEST_STORE_ID,phase=env.WTES_BILLING_TEST_PHASE;
 if((env.WTES_WORKSPACE_SECRET&&secret===env.WTES_WORKSPACE_SECRET)||(env.WTES_WORKSPACE_STORE_ID&&storeId===env.WTES_WORKSPACE_STORE_ID)||(env.WTES_BILLING_SECRET&&secret===env.WTES_BILLING_SECRET)||(env.WTES_BILLING_STORE_ID&&storeId===env.WTES_BILLING_STORE_ID)||(env.WTES_PADDLE_WEBHOOK_SECRET&&webhookSecret===env.WTES_PADDLE_WEBHOOK_SECRET)||(env.WTES_PADDLE_API_KEY&&apiKey===env.WTES_PADDLE_API_KEY))return null;
 if(env.WTES_BILLING_TEST_ENABLED!=='true'||!owner||!apiKey||!clientToken||!priceId||!/^user_[A-Za-z0-9]+$/.test(owner)||!/^pdl_sdbx_[A-Za-z0-9_]+$/.test(apiKey)||!/^test_[A-Za-z0-9_]+$/.test(clientToken)||!/^pri_[a-z0-9]+$/i.test(priceId)||!webhookSecret||!secret||Buffer.byteLength(secret)<32||!storeId||!/^store_[A-Za-z0-9]+$/.test(storeId)||(phase!=='active'&&phase!=='expired'))return null;
 return {owner,apiKey,clientToken,priceId,webhookSecret,secret,storeId,phase,environment:'sandbox',api:'https://sandbox-api.paddle.com'};
}
export function billingTestAuthorized(userId:string|undefined,c=billingTestConfig()){return !!c&&userId===c.owner;}
export function currentBillingTest(){return scope.getStore();}
export function withBillingTest<T>(c:BillingTestContext,fn:()=>T):T{return scope.run(c,fn);}
export async function billingTestBlobCredentials(c:BillingTestContext,oidc:()=>Promise<string>=getVercelOidcToken){const oidcToken=(await oidc()).trim();if(!oidcToken)throw new Error('Test store OIDC unavailable');return {storeId:c.storeId,oidcToken};}
function trialPath(c:BillingTestContext){return 'wtes-billing-test/trial/'+c.phase+'/'+createHmac('sha256',c.secret).update(c.owner).digest('hex')+'.json';}
export async function testTrial(c:BillingTestContext){const credentials=await billingTestBlobCredentials(c);const result=await get(trialPath(c),{access:'private',...credentials,useCache:false,abortSignal:AbortSignal.timeout(4000)});if(!result)return null;if(result.statusCode!==200||result.blob.size>2048)throw new Error('Test trial unavailable');const value=openAction<{startedAt:string}>(await new Response(result.stream).text(),c.secret);const start=Date.parse(value.startedAt);if(!Number.isFinite(start))throw new Error('Invalid test trial');return {startedAt:new Date(start).toISOString(),endsAt:new Date(start+30*86400000).toISOString()};}
export async function saveTestTrial(c:BillingTestContext){const existing=await testTrial(c);if(existing)return existing;const startedAt=new Date(Date.now()-(c.phase==='expired'?31*86400000:0)).toISOString();const credentials=await billingTestBlobCredentials(c);await put(trialPath(c),sealAction({startedAt},c.secret),{access:'private',...credentials,addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',abortSignal:AbortSignal.timeout(4000)});return testTrial(c);}
