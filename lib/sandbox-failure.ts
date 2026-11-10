import {PayPalError} from './paypal';

/** Keep diagnostics bounded and avoid logging request data or credential-shaped strings. */
export function sandboxFailure(label:string,stage:string,error:unknown){
 const name=error instanceof Error && ['Error','TypeError','RangeError','SyntaxError','ReferenceError','URIError','AbortError','TimeoutError','ZodError'].includes(error.name)?error.name:'Error';
 const code=error instanceof PayPalError?`${stage}_http_${error.status}`:`${stage}_${name}`;
 const raw=error instanceof Error?error.message.split(/\r?\n/,1)[0]:'Unknown error';
 const sanitized=raw.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[redacted]')
  .replace(/\bBearer\s+\S+/gi,'Bearer [redacted]')
  .replace(/\bA21[A-Za-z0-9._-]*/g,'[redacted]')
  .replace(/[A-Za-z0-9._-]{24,}/g,'[redacted]')
  .replace(/(['"`])[^'"`]*\1/g,'[redacted]')
  .slice(0,200);
 // Error messages can contain unquoted buyer names or provider payloads. Only
 // known fixed runtime and PayPal messages are safe to expose verbatim.
 const safe=/^(?:PayPal sandbox authentication failed\. Check sandbox credentials and permissions\.|PayPal sandbox returned an invalid authentication response\.|PayPal sandbox request failed \(\d{3}\)\.|PayPal returned an invalid (?:transaction|list) page\.|PayPal (?:transaction pagination was invalid|pagination limit reached)\.|Cannot read properties of (?:undefined|null) \(reading \[redacted\]\)|(?:undefined|null) is not an object)$/;
 const detail=safe.test(sanitized)?sanitized:'[redacted]';
 const frames=error instanceof Error?(error.stack||'').split('\n').slice(1).map(line=>line.match(/(?:^|[(/\\\s])([^/\\():\s]+):\d+(?::\d+)?\)?$/)?.[0]?.match(/([^/\\():\s]+:\d+)/)?.[1]).filter(Boolean).slice(0,5).join('|'):'';
 console.error(`${label} stage=${stage} code=${code} msg=${detail} at=${frames}`);
 return {stage,code,detail};
}
