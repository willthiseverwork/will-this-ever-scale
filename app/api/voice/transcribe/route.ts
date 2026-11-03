import {StartStreamTranscriptionCommand,TranscribeStreamingClient} from '@aws-sdk/client-transcribe-streaming';
import {awsCredentialsProvider} from '@vercel/oidc-aws-credentials-provider';
import {sameOrigin} from '../../../../lib/paypal-session';
import {hasPaidOrJudgeAccess} from '../../../../lib/access';
import {voiceIdentity} from '../../../../lib/voice-identity';
import {reserveVoiceClip,voiceAvailable} from '../../../../lib/voice-budget';

export const runtime='nodejs';
const maxBytes=60*16_000*2;
const headers={'Cache-Control':'no-store'};

export async function GET(request:Request){if((process.env.WTES_VOICE_ENABLED!=='true'||process.env.WTES_VOICE_TALKBACK_ENABLED!=='true')||!await hasPaidOrJudgeAccess(request))return Response.json({enabled:false},{headers});const identity=voiceIdentity(request);if(!identity)return Response.json({enabled:false,notice:'Voice is unavailable.'},{headers});const allowance=await voiceAvailable({identity});return Response.json({enabled:allowance.allowed,notice:allowance.allowed?undefined:'Voice is used up for today. Typing works the same.'},{headers});}

/** Audio is streamed to Transcribe and discarded; this route never persists or logs it. */
export async function POST(request:Request){const started=performance.now();
 if(process.env.WTES_VOICE_ENABLED!=='true'||process.env.WTES_VOICE_TALKBACK_ENABLED!=='true')return Response.json({error:'Voice input is not available yet.'},{status:503,headers});
 if(!sameOrigin(request)||!await hasPaidOrJudgeAccess(request))return Response.json({error:'Voice input needs access.'},{status:403,headers});
 const roleArn=process.env.WTES_BEDROCK_ROLE_ARN;
 if(process.env.VERCEL_ENV!=='production'||!roleArn||!/^arn:aws:iam::\d{12}:role\/wtes-bedrock-production$/.test(roleArn))return Response.json({error:'Voice input is not configured.',hideMic:true},{status:503,headers});
 const declared=Number(request.headers.get('content-length')||0);if(declared>maxBytes)return Response.json({error:'Record up to 60 seconds.'},{status:413,headers});const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0;if(reader){for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes){await reader.cancel();return Response.json({error:'Record up to 60 seconds.'},{status:413,headers})}chunks.push(part.value)}}const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.byteLength}
 if(!raw.byteLength||raw.byteLength%2!==0)return Response.json({error:'Record up to 60 seconds.'},{status:413,headers});
 const clipIdentity=voiceIdentity(request),allowance=clipIdentity?await reserveVoiceClip(clipIdentity,{seconds:raw.byteLength/32000}):{allowed:false as const,reason:'unavailable' as const};
 if(!allowance.allowed)return Response.json({error:allowance.reason==='daily'?'Voice is used up for today. Typing works the same.':allowance.reason==='monthly'?'Voice input is unavailable this month.':'Voice input is unavailable.',hideMic:true},{status:429,headers});
 const currency=new URL(request.url).searchParams.get('currency');
 try{
  const client=new TranscribeStreamingClient({region:'us-east-1',credentials:awsCredentialsProvider({roleArn,clientConfig:{region:'us-east-1'}})});
  const command=new StartStreamTranscriptionCommand({LanguageCode:currency==='GBP'?'en-GB':'en-US',MediaEncoding:'pcm',MediaSampleRateHertz:16_000,AudioStream:(async function*(){yield {AudioEvent:{AudioChunk:raw}};})()});
  const response=await client.send(command);
  let text='';
  for await(const event of response.TranscriptResultStream||[]){for(const result of event.TranscriptEvent?.Transcript?.Results||[])if(!result.IsPartial)text+=(result.Alternatives?.[0]?.Transcript||'')+' ';}
  return Response.json({text:text.trim()},{headers:{...headers,'Server-Timing':`transcribe;dur=${Math.round(performance.now()-started)}`}});
 }catch{return Response.json({error:'Voice input is temporarily unavailable.',hideMic:true},{status:503,headers});}
}
