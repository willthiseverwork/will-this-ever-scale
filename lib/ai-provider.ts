import type { LanguageModel } from 'ai';
type Environment=Record<string,string|undefined>;
/** Project-specific static credentials or explicitly enabled Vercel OIDC only; never ambient AWS credentials. */
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
 const auth=env.WTES_BEDROCK_AUTH;
 if(auth==='vercel_oidc'){
  // The IAM trust policy restricts the configured role to the reviewed project.
  const roleArn=env.WTES_BEDROCK_ROLE_ARN;
  if(env.VERCEL_ENV!=='production'||region!=='us-east-1'||model!=='us.anthropic.claude-sonnet-5-5'||!roleArn||!/^arn:aws:iam::\d{12}:role\/wtes-bedrock-production$/.test(roleArn)||bearer||accessKeyId||secretAccessKey||sessionToken)return null;
  const {awsCredentialsProvider}=await import('@vercel/oidc-aws-credentials-provider');
  const {createAmazonBedrock}=await import('@ai-sdk/amazon-bedrock');
  return createAmazonBedrock({region,baseURL:`https://bedrock-runtime.${region}.amazonaws.com`,apiKey:'',credentialProvider:awsCredentialsProvider({roleArn,clientConfig:{region:'us-east-1'}})})(model);
 }
 if(auth&&auth!=='static')return null;
 if(bearer&&(accessKeyId||secretAccessKey||sessionToken))return null;
 if(!bearer&&(!accessKeyId||!secretAccessKey))return null;
 const {createAmazonBedrock}=await import('@ai-sdk/amazon-bedrock');
 const settings={region,baseURL:`https://bedrock-runtime.${region}.amazonaws.com`,apiKey:bearer||'',...(!bearer?{credentialProvider:async()=>({accessKeyId:accessKeyId!,secretAccessKey:secretAccessKey!,...(sessionToken?{sessionToken}:{})})}:{})};
 return createAmazonBedrock(settings)(model);
}
