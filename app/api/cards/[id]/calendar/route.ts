import playbook from '../../../../../playbook.json';
import {reminderCalendar} from '../../../../../lib/calendar';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 const {id}=await context.params;const card=(playbook.leaks as unknown as Array<{id:string;name:string;lesson?:{check:string}}>).find(x=>x.id===id&&x.lesson?.check);
 if(!card)return new Response('This card does not have a calendar check.',{status:404});
 const now=new Date(),due=new Date(now);due.setUTCDate(due.getUTCDate()+30);
 return new Response(reminderCalendar(due.toISOString().slice(0,10),{id:card.id,title:card.name,metric:card.lesson!.check},now),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`attachment; filename="check-${card.id}.ics"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
