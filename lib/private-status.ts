/** Only provider status codes are retained, never arbitrary CSV text. */
export const privateStatuses=['completed','pending','failed','denied','refused','declined','cancelled','canceled','unpaid','unclaimed','refunded','partially refunded','reversed','held','on hold','paid'] as const;
export function privateStatus(value:string|undefined){const normalized=value?.trim().toLowerCase();return privateStatuses.find(status=>status===normalized)}
