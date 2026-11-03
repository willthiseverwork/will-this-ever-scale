# Business model release and recovery

This record covers the Phase A implementation and its operational limits. The release owner must fill in the final source SHA, deployment ID and production evidence after independent review. No production release is implied by this document.

## Compatibility and rollback

New business facts, assignment metadata and per-upload encryption keys live in the existing encrypted private Blob store under an owner-scoped journal. Older whole-workspace saves cannot overwrite it. The pre-journal deployment `0ba8ca29873f0e8229eb0b64e0d30ca1655a5cdc` is **not** an admissible rollback: its deletion paths do not know the journal exists.

The compatible fallback must use the reviewed post-journal source and a separately built deployment with `WTES_BUSINESS_READ_ONLY=true`. Its GET paths retain access to the journal and export; business commands, monthly saves, workspace saves and new upload writes are refused, except that withdrawing assistant sharing remains available. Workspace, individual-upload and account deletion paths remain enabled and retain the journal fence. Build and test this exact fallback before release, record its immutable deployment ID and source SHA, and verify its read-only status and deletion/no-resurrection behavior with an isolated synthetic account. The release owner controls deployment and aliasing. Never promote a pre-journal artifact as fallback.

## Upload interruption and deletion

New upload stages use random per-upload keys kept only in the encrypted journal. A seller can recover a complete interrupted stage without supplying the original file; an absent stage is abandoned and its attempt ID is retired. Workspace or source deletion can preempt an in-flight stage, invalidate its journal reference and key, and prevent a late writer from publishing it. A late request can still leave encrypted orphan ciphertext in Blob after the initial cleanup; without its erased random key it is inaccessible to the application. Physical removal of such a late orphan is not established by the current tests and must not be represented as verified. Legacy uploads use the original index and encryption and are deleted through the retained compatibility path.

## Interpretation and coverage

Business and product assignment is explicit. Matching titles, account identity and judge access do not verify a merchant. Old ambiguous uploads stay unassigned until the seller confirms their business and source. Existing historical summaries are not proof of settlement when their status is absent. Monthly partial views count supported same-currency events, identify missing statuses, fees and quantities, and do not allocate mixed-cart charges without evidence. They are not a complete business profit statement. Confirmed monthly help is deducted once only when the seller confirms full-month coverage; otherwise it remains outside the amount. Owner time with zero cash pay is not valued as an economic cost. Approximate answers remain labelled as estimates. Ranges are not yet stored: the interview asks for one amount or a skip instead of silently using a midpoint.

Corrections retain prior facts and use their stated effective dates. Saved monthly versions preserve a calculation and input digest while its sources remain. Source deletion removes dependent views and import assignments; independently confirmed seller facts remain. The journal and export are bounded; the app refuses a write at the limit rather than silently evicting history.

A seller can save a trading start date, but recommendation eligibility has not been integrated with that fact; no claim is made that all short-history questions are suppressed. A dedicated fixture-copy migration workflow is not yet implemented.

The broader semantic conversation/model evaluation is Phase B and has not been performed. The explicit cost explanation is not evidence that arbitrary paraphrases are understood. No new model call or PayPal financial write is required for this Phase A path.

## Frozen draft reconciliation

The four paused semantic-draft files were backed up byte-for-byte in `work/frozen-semantic-preflight-20261103-201516` under the parent task workspace. `app/api/chat/plan/route.ts` was restored to the existing lookup route; `components/data-chat.tsx` was rebuilt around the existing lookup path and an explicit cost explanation, then extended for scoped saving; `lib/cost-followup.ts` retains the deterministic explanation renderer without the phrase matcher; the untracked `lib/semantic-chat.ts` working copy was moved to the external backup and is not part of this candidate. The backup also contains the original tracked patch and hashes.

## Verification still required

Run the final full suite and production build on the exact candidate; verify the compatible fallback separately. The release owner must then check exact source/alias and actual signed-in, isolated maker, reseller and short-history journeys in Chrome, including a fresh later visit, item selection, zero/unknown, a dated correction, second assigned upload and agreement among card, explicit explanation and monthly view. Verify affected mobile/keyboard behavior, privacy-safe fixed-label analytics, noindex/discovery settings and privacy disclosure. An unavailable archive-RAG lookup or unverified source deletion/rollback behavior remains an explicit handoff gap; do not mark the release complete on build or deployment alone.
