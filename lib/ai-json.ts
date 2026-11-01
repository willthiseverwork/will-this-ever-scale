/** Accept the model's JSON object, with an optional single Markdown JSON fence. */
export function parseAiJson(text:string):unknown|null {
 const candidate=text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]??text.trim();
 try{return JSON.parse(candidate);}catch{return null;}
}
