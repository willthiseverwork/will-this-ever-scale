/** Read-only order verification. Credentials are passed in memory and never printed. */
import { Client,Environment,OrdersController,ApiError } from '@paypal/paypal-server-sdk';
import { pathToFileURL } from 'node:url';
type Credentials={clientId:string;clientSecret:string};
export async function verifySandboxOrder(credentials:Credentials,orderId:string,adapter?:unknown){
 if(!/^[A-Za-z0-9-]{1,64}$/.test(orderId)||!credentials.clientId||!credentials.clientSecret)throw new Error('Invalid sandbox order verification input.');
 const client=new Client({environment:Environment.Sandbox,timeout:15000,clientCredentialsAuthCredentials:{oAuthClientId:credentials.clientId,oAuthClientSecret:credentials.clientSecret},httpClientOptions:{retryConfig:{maxNumberOfRetries:0}},...(adapter?{unstable_httpClientOptions:{adapter}}:{})});
 try{const response=await new OrdersController(client).getOrder({id:orderId});const order=response.result;if(!order.id||order.id!==orderId||!order.status)throw new Error('Incomplete order response.');const captures=(order.purchaseUnits||[]).flatMap(unit=>unit.payments?.captures||[]).map(c=>({id:c.id??null,status:c.status??null,amount:c.amount?.value??null,currency:c.amount?.currencyCode??null}));return {orderId:order.id,orderStatus:order.status,captures,captureEvidence:captures.some(c=>c.status==='COMPLETED')?'completed':captures.length?'not_completed':'not_observed'};}
 catch(e){if(e instanceof ApiError)return {orderId,status:'unavailable' as const,httpStatus:e.statusCode};return {orderId,status:'unavailable' as const};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const orderId=process.argv[2]||'';verifySandboxOrder({clientId:process.env.PAYPAL_SANDBOX_CLIENT_ID||'',clientSecret:process.env.PAYPAL_SANDBOX_CLIENT_SECRET||''},orderId).then(x=>console.log(JSON.stringify(x,null,2))).catch(()=>{console.error('Order verification input is missing or invalid.');process.exitCode=1;});}
