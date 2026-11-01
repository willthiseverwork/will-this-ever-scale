export type TestCheckoutState='idle'|'opening'|'loaded'|'closed'|'completed'|'error';
/** Interpret only fixed event names; never retain or display event payloads. */
export function testCheckoutEvent(current:TestCheckoutState,event:unknown):TestCheckoutState {
 if(!event||typeof event!=='object')return current;
 const name=(event as {name?:unknown}).name;
 if(name==='checkout.loaded')return 'loaded';
 if(name==='checkout.completed')return 'completed';
 if(name==='checkout.closed')return current==='completed'||current==='error'?current:'closed';
 if(name==='checkout.error')return 'error';
 return current;
}
