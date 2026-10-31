/** Local calendar file: does not transmit the seller's email or business data. */
export function reminderCalendar(date:string):string {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date.');
  const d=new Date(`${date}T00:00:00Z`);
  if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==date) throw new Error('Invalid date.');
  const end=new Date(d.valueOf()+86400000).toISOString().slice(0,10).replaceAll('-','');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Will This Ever Scale//Reminder//EN','BEGIN:VEVENT',`UID:${crypto.randomUUID()}@willthiseverscale.com`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${date.replaceAll('-','')}`,`DTEND;VALUE=DATE:${end}`,'SUMMARY:Check your business test','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
