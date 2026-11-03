import {createAmazonBedrock} from '@ai-sdk/amazon-bedrock';import {awsCredentialsProvider} from '@vercel/oidc-aws-credentials-provider';import {reserveAiBudget} from '../ai-budget';
const NOVA='us.amazon.nova-2-lite-v1:0';
/** This voice-only transport has a separately bounded reasoning allowance. */
export function voiceModel(modelId:string){const roleArn=process.env.WTES_BEDROCK_ROLE_ARN;if(process.env.VERCEL_ENV!=='production'||process.env.WTES_BEDROCK_AUTH!=='vercel_oidc'||!roleArn||!/^arn:aws:iam::\d{12}:role\/wtes-bedrock-production$/.test(roleArn)||!(modelId===NOVA||/^(?:us\.)?anthropic\.[A-Za-z0-9:._-]+$/.test(modelId)))return null;
 const guarded:typeof fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.origin!=='https://bedrock-runtime.us-east-1.amazonaws.com'||decodeURIComponent(url.pathname)!==`/model/${modelId}/converse`||url.search||init?.method!=='POST'||typeof init.body!=='string'||Buffer.byteLength(init.body)>12000)throw new Error('VoiceModelBoundary');const body=JSON.parse(init.body),max=body.inferenceConfig?.maxTokens;if(!Number.isInteger(max)||max<1||max>15000)throw new Error('VoiceModelBoundary');if(modelId===NOVA&&(body.additionalModelRequestFields?.reasoningConfig?.type!=='enabled'||body.additionalModelRequestFields?.reasoningConfig?.maxReasoningEffort!=='low'))throw new Error('VoiceModelBoundary');const budget=await reserveAiBudget();if(!budget.allowed)throw new Error('VoiceModelBudget');return fetch(input,init)};
 return createAmazonBedrock({region:'us-east-1',baseURL:'https://bedrock-runtime.us-east-1.amazonaws.com',apiKey:'',fetch:guarded,credentialProvider:awsCredentialsProvider({roleArn,clientConfig:{region:'us-east-1'}})})(modelId);
}
export const novaVoiceModel=NOVA;
/** A refused configured Claude model falls back once; no prompt or response is logged. */
export async function voiceWithFallback<T>(configured:string,invoke:(modelId:string)=>Promise<T>):Promise<T>{
 try{return await invoke(configured)}catch(error){const status=(error as {statusCode?:number})?.statusCode;if(configured!==NOVA&&(status===403||(error instanceof Error&&/accessdenied/i.test(error.name)))){console.info('voice_model_fallback',{code:'access_denied'});return invoke(NOVA)}throw error}
}
/** Options are passed through the installed Bedrock provider's version-matched schema. */
export function voiceGenerationOptions(modelId:string){return modelId===NOVA?{providerOptions:{bedrock:{reasoningConfig:{type:'enabled' as const,maxReasoningEffort:'low' as const}}}}:{};}
