import raw from '../playbook.json';
export type Answers=Record<string,string>;
export function questionsFor(leakId:string) { return raw.leaks.find((x:any)=>x.id===leakId)?.questions||[]; }
export function testFor(leakId:string,answers:Answers,context:Record<string,string|number>) { const leak:any=raw.leaks.find((x:any)=>x.id===leakId); if(!leak) throw new Error('That leak is not in the playbook.'); const selected=leak.tests.find((t:any)=>!t.when||Object.entries(t.when).every(([k,v]:any)=>v.includes(answers[k])))||leak.tests[0]; const fill=(s:string)=>s.replace(/\{(\w+)\}/g,(_,k)=>String(context[k]??k)); return {do:fill(selected.do),success:fill(selected.success),who:leak.who}; }
