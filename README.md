# Will This Ever Scale

A plain-language money map for sellers using PayPal. The sample shop is synthetic. Uploaded CSV files are parsed and analyzed in the browser. If the seller requests an AI read, only a strict set of numeric totals and fixed finding IDs is sent; no transaction rows or item names are sent in that request.

## Try it

Production: [app.willthiseverscale.com](https://app.willthiseverscale.com). The sample jewelry shop is synthetic, dated 31 October 2026; PayPal actions use its separately identified sandbox test copies.

1. Select **Open the demo shop**, then **Skip both** or enter item costs and monthly ad spend. The October read shows the money map, the largest monthly opportunity, three unpaid invoices totaling USD 540, other findings and an item concentration risk.
2. Open **Show the math** to see AG Grid month and item tables and the calculation behind the first finding. Close with Escape, Back, or the close button.
3. Choose **What to do about it**, answer the questions, and inspect the test, fixed lesson steps and 30-day check. **Add a calendar reminder** downloads an `.ics` file without collecting an email.
4. Open **See your plan**, then **Remind them in PayPal**. The review reads the mapped invoices from PayPal and displays their real titles, balances, ages and exact reminder note. **Approve** sends the displayed batch in order. Keep the page open; **Stop the rest** cancels waiting rows. A successful result includes PayPal's real invoice ID. Unknown results are never called sent or silently replayed. Previously confirmed reminders are labeled **Already sent**.
5. To try your own data, download the sample CSV and upload it on the start screen. CSV rows remain in browser memory; the analysis survives a refresh, but changing costs after a refresh requires uploading again. CSV findings cannot send to a previously connected sandbox account.
6. **Connect sandbox → Use the demo sandbox** reads the real test account without keys. Its shorter history has intentional empty states and follows the real 14-day invoice rule. Developers can instead enter their own sandbox app credentials. The initial connection and read happen together. Cost and ad changes use sanitized rows held only in browser memory for the visit; after a refresh, connect and read again to change those assumptions. A later provider action may require reconnecting if its server-memory session expires.

No PayPal action runs on page load or when preparing a review. Approve is a real sandbox notification action, not a visual simulation. The existing seeded purchases and notifications must not be replayed as setup or verification.

## Run locally

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

The app uses deterministic wording when the configured AI provider is unavailable. Amazon Bedrock is the default (`AI_PROVIDER=bedrock`). The intended reviewed production configuration uses `AWS_BEDROCK_REGION=us-east-1`, inference profile `AWS_BEDROCK_MODEL=us.amazon.nova-2-lite-v1:0`, and production-only Vercel OIDC with `WTES_BEDROCK_AUTH=vercel_oidc` and the explicitly scoped `WTES_BEDROCK_ROLE_ARN`. The role and its model permissions must be configured separately; the app does not grant them. OIDC rejects static credentials. Other supported setups can use either `WTES_BEDROCK_API_KEY` or `WTES_BEDROCK_ACCESS_KEY_ID` and `WTES_BEDROCK_SECRET_ACCESS_KEY` with an optional session token, but must not mix credential types. Direct Anthropic access is optional and separate.

Sonnet 5.5 and Sonnet 5 returned an AWS account-access denial. Nova 2 Lite passed production checks for a money summary, privacy-safe item grouping, and an allowed action suggestion on 31 October 2026. Calls use AWS billing; allocation against promotional credits is not yet verified. Live AI remains gated by a verified external production rate limit and `AI_RATE_LIMIT_ENFORCED=true`; a flag alone does not provide protection. Demo wording never invokes the model: it uses a reviewed static AI read only when its aggregate matches exactly, otherwise the deterministic template. Output is checked against the numeric aggregate and falls back to the template when unavailable or invalid. The production Nova transport also reserves from a shared private monthly allowance of 500 model calls, with a maximum 12,000-byte text request and 300 output tokens per call. It stops making model calls if the allowance or storage is unavailable; free demo and deterministic analysis remain usable. See [AI allowance and cost boundaries](docs/ai-budget.md).

## Data and APIs

- `POST /api/analyze`: accepts `{source:"demo"}`, `{source:"aggregate", aggregate:...}`, or `{source:"grouping", descriptors:[...]}` validated by the strict aggregate or descriptor schema. Aggregate and demo reads return `{read, read_source, suggestions}`; grouping returns `{mappings, source}`. `read_source` distinguishes a validated model read, a reviewed cached sample read, and the deterministic template; suggestions identify whether the model selected them or the template generated them. Suggestions cannot execute actions. CSVs, rows, names and free-text item labels are rejected. The browser owns CSV calculation and retains the full analysis locally.
- `POST /api/questions`: accepts a fixed `leakId` and returns questions from the bundled playbook. The browser evaluates the selected test using `questionsFor`, `contextFor`, and `testFor`; the retired `POST /api/test` returns 410. A missing target is an explicit gap, not a guessed answer.
- `POST /api/sandbox/connect` and `/api/sandbox/analyze`: connect and read a PayPal sandbox. Credentials are held in server memory for the session and can be lost on instance changes. Sandbox coverage and unavailable endpoints are returned separately. The app does not connect a live PayPal account.
- `POST /api/actions/propose` and `/api/actions/execute`: sandbox-only actions require a verified invoice review and signed approval. Each batch execution advances one invoice; `/api/actions/status` reads progress and `/api/actions/stop` cancels remaining rows. An encrypted private Blob ledger reserves each dispatch before calling PayPal and retains deduplication receipts. No provider retry is made after an ambiguous notification dispatch. Signing, private storage and sandbox credentials are required; never commit them.
- `GET /api/cards/[id]/calendar`: returns a calendar event 30 days out with the card title, metric and tool link. It does not send email or register a background job.
- `POST /api/cards/[id]/drafts`: returns fixed parcel-card, opt-in welcome or set-description drafts. Any shop-specific placeholders are filled in the browser. These drafts never send messages.
- `POST /api/drafts/reminder`: optionally drafts a short invoice note using a static prompt without seller data. Invalid or unavailable model output falls back immediately. A signed note token binds any selected AI text to the reviewed proposal. Demo visits use fixed wording without calling a model.
- `POST /api/reminders`: validates an email, date and playbook ID, then stores them in a private Blob when configured. **Email delivery is not configured**; a saved record is not a sent reminder. The browser can instead generate a local calendar file without providing an email.

Opt-in Google Analytics is restricted to the canonical production host, using fixed control IDs and sanitized origin/path. Values entered into forms and uploaded data are not sent as event parameters. Live analytics receipt and search indexing require separate production verification.

## Calculation boundaries

See [the formula reference](docs/calculations.md) for every finding, its evidence, and the hand-checked fixtures. Regenerate the synthetic CSV with `node --import tsx scripts/generate-sample-csv.ts`.

The engine selects the dominant sales currency and reports excluded currencies. It calculates gross sales, known payment fees, refunds and supplied costs and ad spend. Missing costs and other coverage gaps are shown separately. Findings are estimates based on explicit assumptions, not verified causes. Unpaid invoice results cover only invoice records supplied or returned by the sandbox; an absence of such records is not proof that no unpaid invoices exist. The playbook retains the supplied source text; target calculations are deterministic and fail when supporting values are missing.

## Sandbox setup

Create a sandbox REST app in [PayPal Developer](https://developer.paypal.com/), enable the required sandbox APIs, and configure server-only `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, and `PAYPAL_ACTION_SIGNING_SECRET`. Use sandbox credentials only. Transaction Search may have reporting delays. The integration and any sandbox action must be verified against the intended sandbox account before claiming a successful action.

For a new installation, seed products and invoices with `scripts/seed-sandbox.ts` using the explicit confirmation flag documented in that script. Keep its durable receipt outside the public repository and inspect ambiguous outcomes before retrying. Set `PAYPAL_SANDBOX_DEMO_INVOICE_IDS` to the three verified invoice IDs in receipt order. The private loopback console in `scripts/seed-console.ts` is for local setup only and is not a deployed route. Captured orders require a separate sandbox buyer approval; the script does not claim to create payment history. The hosted demo seed has five catalog products, three captured sandbox purchases ($18, $28 and $35), and three unpaid $180 invoices. These fixtures are already created; do not replay the seed. PayPal Merchant Insights is not supported in sandbox by the installed Toolkit.

## Current limitations

The production provider is Amazon Nova 2 Lite through Bedrock. Reviewed demo wording is cached and costs no model calls. The original AI analysis routes retain their production firewall and process safeguards. The reminder-draft route adds a shared request limiter and uses the same protected 500-call monthly provider allowance. Invalid model output falls back to deterministic wording. AWS credit allocation remains unverified. Optional AI grouping sends only browser-derived fixed product features, indexes and order counts; titles remain on the device. Unsupported or uncertain titles remain unchanged. The grouping response contains only validated canonical group labels and indexes, and falls back to an empty mapping when unavailable. Action suggestions use fixed, evidence-bound templates while the model is unavailable; a configured model may select from two allowlisted suggestions, never execute them. Item titles and invoice IDs are not sent to the AI. Every PayPal action still requires an explicit approval. Memory-only sandbox connections can expire or be lost when a server instance changes; reconnect when asked. Reviewed proposals and dispatch receipts are encrypted in private durable storage. An approval expires after five minutes, and an unknown dispatch is never silently replayed. No email reminder is sent. Separate fee-only rows, unlinked item refund rates, and complete subscription state need more evidence and are disclosed in the app. See [dependency security](dependencies-security.md) for outstanding upstream advisories and mitigations.

## Sponsor tools used

AG Grid Community powers the month-by-month and item tables in the math drawer. No commercial grid license is required. PayPal Agent Toolkit is the first route for supported sandbox reads and reminders, with a REST fallback only before a toolkit dispatch; an ambiguous send is not retried through another transport. The PayPal/APIMatic Context Plugin was used for the read-only sandbox order and capture verification tool; see [the exact contribution and tests](docs/paypal-server-sdk-context.md). It is not credited for earlier implementation, and no sponsor claim has been submitted.

The new lesson-backed cards cover repeat buyers, refunds, small-payment fees, sets and held money. Hold detection requires explicit current-hold and absent-tracking evidence; a generic pending status is insufficient. The synthetic demo includes six such payments totaling USD 210. The live PayPal read does not yet establish both signals, so it does not offer an unverified tracking action. Dasha explicitly chose to preserve the existing item-risk, below-cost, fewer-new-buyer and failed-subscription findings until their additional lesson text is supplied. Lesson steps are fixed source text, never rewritten by the model.

## License

MIT; see [LICENSE](LICENSE).


## Chat, workspace and connections

The app includes data chat, saved-workspace support and a public synthetic MCP demo. Dedicated WorkOS sign-in and private storage are configured; anonymous access protections and the hosted account build are verified. A real email-code sign-in and saved-account lifecycle are still pending. The private MCP endpoint and local Codex and Claude Code clients are configured; owner authorization and the real private data lifecycle remain unverified. Live PayPal daily refresh and billing are not yet operational. A downloadable plugin is not proof of installation or a connected account.

- `/chat` answers sales, refund, fee and monthly comparison questions from the browser analysis. Calculations stay local. The optional model intent helper accepts only fixed tokens and month IDs; it never receives the question text or product names.
- `/workspace` keeps local reminders without sign-in. Account storage uses the dedicated WorkOS project and encrypted private store; the real signed-in lifecycle remains unverified. Saving a CSV summary is explicit; raw CSV rows are not stored. Assistant workspace access and reviewed-product-label sharing are separate controls and both default off. Turning workspace sharing off blocks the next private assistant request.
- `/connect` offers a downloadable plugin package and a public synthetic sample at `/mcp`. Private OAuth metadata is configured and anonymous private calls require authentication; owner login and private workspace access remain unverified. A package download is not an installed or connected client.
- `/billing` exposes the planned $14.99/month offer after a 30-day no-card trial. Billing remains off by default; no payment is collected without a configured provider and explicit checkout. The free demo remains unrestricted for judges.
- Live merchant PayPal access and daily refresh are not activated. The read-only transport and atomic snapshot orchestration are prepared, but require an approved merchant grant, secure storage and a configured daily job. CSV upload remains the current own-data entry point.

See `docs/workspace.md`, `docs/data-chat.md`, `docs/plugin.md`, `docs/live-paypal.md` and `docs/billing.md` for exact configuration and verification boundaries. Never reuse another product's provider credentials.

The current production source is `f951982` on deployment `dpl_CXfDbgkuc5Jq9zcViX5ngQEijCBk`; the hosted build passed 173 tests. To authorize the already configured local clients, the owner can run `codex mcp login wtes-private --scopes summaries:read` or `claude mcp login wtes-private`. Verify each client and the workspace sharing setting before relying on private results.
