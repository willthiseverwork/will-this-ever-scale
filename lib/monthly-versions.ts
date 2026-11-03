/** Keep saved order intact while identifying the newest version per month and currency. */
export function monthlyVersions<T extends {id:string;createdAt:string;result:{month:string;currency:string}}>(views:readonly T[]){const seen=new Set<string>();return [...views].reverse().map(view=>{const key=JSON.stringify([view.result.month,view.result.currency]),latest=!seen.has(key);seen.add(key);return {view,latest}})}
export function savedAtUtc(value:string){return new Date(value).toISOString().replace('T',' ').replace('Z',' UTC')}
