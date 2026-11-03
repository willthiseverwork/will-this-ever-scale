import {synthesizeSpeech} from '../../../../lib/voice/polly';
import {awsCredentialsProvider} from '@vercel/oidc-aws-credentials-provider';
import {z} from 'zod';import {readLimitedJson} from '../../../../lib/request';import {hasPaidOrJudgeAccess} from '../../../../lib/access';import {sameOrigin} from '../../../../lib/paypal-session';import {voiceIdentity} from '../../../../lib/voice-identity';import {reserveSpeech} from '../../../../lib/voice-budget';
export const runtime='nodejs';
export async function POST(request:Request){const start=performance.now(),headers={'Cache-Control':'no-store'};const fail=(status:number,error:string)=>Response.json({error},{status,headers:{...headers,'Server-Timing':`speech;dur=${Math.round(performance.now()-start)}`}});
 if(process.env.WTES_VOICE_ENABLED!=='true'||process.env.WTES_VOICE_TALKBACK_ENABLED!=='true')return fail(503,'Voice is unavailable.');if(!sameOrigin(request)||!await hasPaidOrJudgeAccess(request))return fail(403,'Voice needs access.');
 const roleArn=process.env.WTES_BEDROCK_ROLE_ARN;if(process.env.VERCEL_ENV!=='production'||!roleArn||!/^arn:aws:iam::\d{12}:role\/wtes-bedrock-production$/.test(roleArn))return fail(503,'Voice is unavailable.');
 try{const parsed=z.object({text:z.string().trim().min(1).max(1500),currency:z.string().regex(/^[A-Z]{3}$/)}).strict().parse(await readLimitedJson(request,8000));const identity=voiceIdentity(request);if(!identity)return fail(503,'Voice is unavailable.');const allowance=await reserveSpeech(identity,[...parsed.text].length);if(!allowance.allowed)return fail(429,'Voice is used up for today. Typing works the same.');
  const audio=await synthesizeSpeech(parsed.text,parsed.currency,awsCredentialsProvider({roleArn,clientConfig:{region:'us-east-1'}}));return new Response(audio,{headers:{...headers,'Content-Type':'audio/mpeg','Server-Timing':`speech;dur=${Math.round(performance.now()-start)}`}});
 }catch(e){const code=e instanceof Error&&/^[A-Za-z0-9_]{1,60}$/.test(e.name)?e.name:'VoiceError';console.info('voice_speak_error',{code});return fail(503,'Voice is unavailable.');}
}
