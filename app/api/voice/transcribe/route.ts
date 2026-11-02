import {StartStreamTranscriptionCommand,TranscribeStreamingClient} from '@aws-sdk/client-transcribe-streaming';
import {awsCredentialsProvider} from '@vercel/oidc-aws-credentials-provider';
import {createHmac} from 'node:crypto';
import {hasPaidOrJudgeAccess} from '../../../../lib/access';
import {session} from '../../../../lib/workspace-auth';
import {reserveVoiceClip,voiceAvailable} from '../../../../lib/voice-budget';

export const runtime='nodejs';
const maxBytes=60*16_000*2;
const headers={'Cache-Control':'no-store'};

function cookie(request:Request,name:string){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
function identity(request:Request){const secret=process.env.WTES_WORKSPACE_SECRET;if(!secret||Buffer.byteLength(secret)<32)return null;const user=session(request);const source=user?`user:${user.userId}`:`judge:${cookie(request,'wtes_judge')}:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||''}`;if(!user&&!cookie(request,'wtes_judge'))return null;return createHmac('sha256',secret).update(`wtes-voice:${source}`).digest('hex');}
export async function GET(request:Request){if(process.env.WTES_VOICE_ENABLED!=='true'||!await hasPaidOrJudgeAccess(request))return Response.json({enabled:false},{headers});const allowance=await voiceAvailable();return Response.json({enabled:allowance.allowed,notice:allowance.allowed?undefined:'Voice input is unavailable this month.'},{headers});}

/** Audio is streamed to Transcribe and discarded; this route never persists or logs it. */
export async function POST(request:Request){
 if(process.env.WTES_VOICE_ENABLED!=='true')return Response.json({error:'Voice input is not available yet.'},{status:503,headers});
 if(!await hasPaidOrJudgeAccess(request))return Response.json({error:'Voice input needs access.'},{status:403,headers});
 const roleArn=process.env.WTES_BEDROCK_ROLE_ARN;
 if(process.env.VERCEL_ENV!=='production'||!roleArn||!/^arn:aws:iam::\d{12}:role\/wtes-bedrock-production$/.test(roleArn))return Response.json({error:'Voice input is not configured.',hideMic:true},{status:503,headers});
 const raw=new Uint8Array(await request.arrayBuffer());
 if(!raw.byteLength||raw.byteLength>maxBytes)return Response.json({error:'Record up to 60 seconds.'},{status:413,headers});
 const clipIdentity=identity(request),allowance=clipIdentity?await reserveVoiceClip(clipIdentity):{allowed:false as const,reason:'unavailable' as const};
 if(!allowance.allowed)return Response.json({error:allowance.reason==='daily'?'You have used today’s 20 voice clips.':allowance.reason==='monthly'?'Voice input is unavailable this month.':'Voice input is unavailable.',hideMic:true},{status:429,headers});
 const currency=new URL(request.url).searchParams.get('currency');
 try{
  const client=new TranscribeStreamingClient({region:'us-east-1',credentials:awsCredentialsProvider({roleArn,clientConfig:{region:'us-east-1'}})});
  const command=new StartStreamTranscriptionCommand({LanguageCode:currency==='GBP'?'en-GB':'en-US',MediaEncoding:'pcm',MediaSampleRateHertz:16_000,AudioStream:(async function*(){yield {AudioEvent:{AudioChunk:raw}};})()});
  const response=await client.send(command);
  let text='';
  for await(const event of response.TranscriptResultStream||[]){for(const result of event.TranscriptEvent?.Transcript?.Results||[])if(!result.IsPartial)text+=(result.Alternatives?.[0]?.Transcript||'')+' ';}
  return Response.json({text:text.trim()},{headers});
 }catch{return Response.json({error:'Voice input is temporarily unavailable.',hideMic:true},{status:503,headers});}
}
