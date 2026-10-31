const escapeCalendar=(text:string)=>text.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function foldCalendar(line:string){const chunks:string[]=[];let part='';for(const char of line){if(new TextEncoder().encode(part+char).byteLength>74){chunks.push(part);part=' '+char;}else part+=char;}chunks.push(part);return chunks.join('\r\n');}
/** Local calendar file: does not transmit the seller's email or business data. */
export function reminderCalendar(date:string,card?:{id:string;title:string;metric:string},now=new Date()):string {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date.');
  const d=new Date(`${date}T00:00:00Z`);
  if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==date) throw new Error('Invalid date.');
  const end=new Date(d.valueOf()+86400000).toISOString().slice(0,10).replaceAll('-','');
  const link=card?`https://app.willthiseverscale.com/leak/${encodeURIComponent(card.id)}`:'https://app.willthiseverscale.com';
  return ['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','PRODID:-//Will This Ever Scale//Reminder//EN','BEGIN:VEVENT',`UID:${crypto.randomUUID()}@willthiseverscale.com`,`DTSTAMP:${now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${date.replaceAll('-','')}`,`DTEND;VALUE=DATE:${end}`,`SUMMARY:${escapeCalendar(card?'Check: '+card.title:'Check your business test')}`,...(card?[`DESCRIPTION:${escapeCalendar(card.metric+'\nOpen the tool and compare your new data.\n'+link)}`,`URL:${link}`]:[]),'END:VEVENT','END:VCALENDAR',''].map(foldCalendar).join('\r\n');
}
