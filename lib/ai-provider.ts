import type { LanguageModel } from 'ai';
type Environment=Record<string,string|undefined>;
/** Only project-specific credentials are read; ambient Vercel AWS credentials and endpoints are ignored. */
export async function selectModel(env:Environment=process.env):Promise<LanguageModel|null>{
 const provider=env.AI_PROVIDER||'bedrock';
 if(provider==='anthropic'){
  if(!env.ANTHROPIC_API_KEY)return null;
  const {createAnthropic}=await import('@ai-sdk/anthropic');
  return createAnthropic({apiKey:env.ANTHROPIC_API_KEY})(env.ANTHROPIC_MODEL||'claude-sonnet-5-5');
 }
 if(provider!=='bedrock')return null;
 const region=env.AWS_BEDROCK_REGION,model=env.AWS_BEDROCK_MODEL;
 if(!region||!model||!/^([a-z]{2}(?:-gov)?-[a-z]+-\d)$/.test(region))return null;
 const bearer=env.WTES_BEDROCK_API_KEY,accessKeyId=env.WTES_BEDROCK_ACCESS_KEY_ID,secretAccessKey=env.WTES_BEDROCK_SECRET_ACCESS_KEY,sessionToken=env.WTES_BEDROCK_SESSION_TOKEN;
 if(bearer&&(accessKeyId||secretAccessKey||sessionToken))return null;
 if(!bearer&&(!accessKeyId||!secretAccessKey))return null;
 const {createAmazonBedrock}=await import('@ai-sdk/amazon-bedrock');
 const settings={region,baseURL:`https://bedrock-runtime.${region}.amazonaws.com`,apiKey:bearer||'',...(!bearer?{credentialProvider:async()=>({accessKeyId:accessKeyId!,secretAccessKey:secretAccessKey!,...(sessionToken?{sessionToken}:{})})}:{})};
 return createAmazonBedrock(settings)(model);
}
