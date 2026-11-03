import type {SellerKind} from '../cost-interview';
/** Accept only a clear choice; an ambiguous answer is asked again. */
export function parseSellerKind(text:string):SellerKind|undefined{const make=/\b(make|craft|handmade|hand make)\b|\b(?:i|we)\s+made\b/i.test(text),buy=/\b(buy|bought|resell|reseller|ready[ -]made)\b/i.test(text);return make===buy?undefined:make?'maker':'reseller'}
