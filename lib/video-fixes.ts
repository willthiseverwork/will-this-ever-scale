/** Voice controls remain available in code but are not offered to sellers yet. */
export const VOICE_UI_ENABLED: boolean = false;

/** A reminder may be approved only after its actual subject and message are shown. */
export function reminderPreviewReady(proposal: {input?: {subject?: unknown; note?: unknown}} | null | undefined): boolean {
 return typeof proposal?.input?.subject==='string' && proposal.input.subject.trim().length>0 && typeof proposal.input.note==='string' && proposal.input.note.trim().length>0;
}

export function latestAnalysisMonth(months: Array<{month:string}>): string | undefined {
 return months.at(-1)?.month;
}
