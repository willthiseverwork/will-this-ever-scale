import type {BrowserRead} from './browser-analysis';
export function shortcutSourceIds(read:BrowserRead){return ((read as BrowserRead&{uploads?:Array<{id:string}>}).uploads||[]).map(x=>x.id).sort()}
/** A changed analysis clock invalidates the opening even with the same files. */
export function shortcutSourceMatches(a:BrowserRead,b:BrowserRead|null){return !!b&&a.source===b.source&&a.analysis.currency===b.analysis.currency&&a.analysis.as_of===b.analysis.as_of&&JSON.stringify(shortcutSourceIds(a))===JSON.stringify(shortcutSourceIds(b))}
