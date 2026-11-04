<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Results-page design verification

For material `/read` UI changes, independently inspect rendered populated desktop and phone views plus a sparse fallback before release. Cover collapsed, expanded, started and exhausted states where applicable. Check legibility, chart scale, hierarchy, single numbered steps, duplicated or missing actions, and clarity of actions and success states. Exercise every changed visible control to its real result, including repeated clicks; mock irreversible operations. Ask a fresh reader to restate the action and success condition and quote repeated, unexplained or unclear lines. Record screenshots and observations, fix defects and recheck. Backend-only changes do not require a new design audit.

## Shared findings and evidence

Repair factual and presentation defects at the shared eligibility, metric or action boundary. Establish the supported population, unit, period and available action, then reuse those rules across affected surfaces and restored analyses. Verify the failing case, a different fixture with the same condition and a nearby allowed case. Do not use fixture IDs or exact phrases as product conditions.

## Sample entry and access

For changes to public sample entry or access, test a cold signed-out visit from the homepage through the primary sample action without injecting or restoring analysis. Exercise every sample and return-to-sample action, and confirm denied or expired access still protects own-data actions. Check the access page on first load independently of prior route visits, including its stylesheet, controls and phone layout. Check that long lists keep primary actions discoverable while preserving the complete selected cohort.

## Results presentation

For changed findings, inventory every requested card face and its detail, then inspect each rendered face for its supported currency, period and short condition; verify its detail reproduces the amount and carries the required counts and assumptions using the actual precision and population. Include restored analyses and a nearby unaffected finding. Verify the same presentation on sample and ordinary partial-data results; do not infer missing evidence.

## Plan and Results route parity

When changing a finding or action, verify the real journey from Results and from Plan through its finding link, including the same supported amount, period, condition, available action, answers and persisted test state. Cover sample invoice details, partial and older saved evidence, and a nearby different finding. The earlier checks exercised playbook functions with hand-supplied values and individual page faces, so they did not detect the engine-to-Plan contract mismatch or duplicated invoice copy. Use `scripts/local-qa/plan-evidence.ts` with synthetic fixtures and blocked external effects; inspect the rendered phone and desktop captures as well as its result.
