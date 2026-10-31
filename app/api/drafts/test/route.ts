import {NextResponse} from 'next/server';
import {sameOrigin} from '../../../../lib/paypal-session';
import {readLimitedJson} from '../../../../lib/request';
import {reserveSandboxRequest} from '../../../../lib/action-store';
import {draftTest,testDraftSchema} from '../../../../lib/test-draft';
import {testTemplateFor} from '../../../../lib/playbook';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 try {const body=testDraftSchema.parse(await readLimitedJson(request,4096));
  const questions=(await import('../../../../lib/playbook')).questionsFor(body.leakId);if(body.answerIds.length!==questions.length)return NextResponse.json({error:'Invalid test answers.'},{status:400});
  const answers=Object.fromEntries(questions.map((question,index)=>[question.id,body.answerIds[index]]));
  if(testTemplateFor(body.leakId,answers).do!==body.template)return NextResponse.json({error:'Invalid test template.'},{status:400});
  const secret=process.env.PAYPAL_ACTION_SIGNING_SECRET;if(!secret||!await reserveSandboxRequest(request,'draft',secret))return NextResponse.json({sentence:body.template,source:'template'},{headers:{'Cache-Control':'no-store'}});
  return NextResponse.json(await draftTest(body),{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Invalid test draft request. Keep seller details in your browser.'},{status:400});}
}
