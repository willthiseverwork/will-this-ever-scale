# Will This Ever Scale

A plain-language money map for sellers using PayPal. The sample shop is synthetic. Uploaded CSV files are parsed and analyzed in the browser. AI chat planning receives questions and item titles with counts and totals, never buyer details, transaction IDs or raw rows.

After a read, optional AI product grouping receives only unique item titles and their order counts. It returns product families, a short shop description and any unplaced titles; this result is cached with the tab's analysis.

## Try it

Production: [app.willthiseverscale.com](https://app.willthiseverscale.com). Judges can enter `PAYPAL-JUDGE-2026` through **Hackathon judge? Use your access code** on the access screen, then choose **Open this demo shop**. The app attempts to read the demo sandbox; if PayPal does not answer or returns no sales, it opens the local sample and says so. The demo merchant's earlier months are generated history because sandbox accounts cannot hold past-dated sales. The seed script and actual sandbox results require the owner setup described in [docs/paypal.md](docs/paypal.md).

Choose **Connect PayPal** to visit PayPal's sandbox login, or use the sales-file and developer-key links. Login identifies the account; it does not grant access to arbitrary sellers' financial data. Only the configured demo merchant is matched to the server-held demo sandbox credentials. Another login is told that its account cannot be read. Real sellers would need an approved PayPal partner onboarding and financial-data grant; neither is active here.

The results include the money map and findings supported by the available data. Unpaid invoice reminders are reviewed before the seller approves them in PayPal. The set payment-link action is behind `WTES_PAYPAL_SET_LINK_ENABLED` until its sandbox probe succeeds. Quiet-regular offers produce messages for the seller to send; this app does not send those messages. The optional cost interview can be typed or, when both voice flags and services are available, spoken. Voice and payment-link live checks remain subject to the release record.

## How PayPal is used

Every connected PayPal request is sandbox-only. The application and its owner-run sandbox tools use these APIs:

- **OAuth and OpenID Connect:** sandbox OAuth token exchange and userinfo identify the demo merchant or authenticate the configured sandbox app. The login token alone does not authorize another seller's transaction data.
- **Transaction Search:** reads the available sales history in bounded, paginated windows. Sandbox reporting can lag by up to three hours.
- **Invoicing v2:** lists and reads invoices, reviews their balances, and sends seller-approved reminders. Existing optional sandbox actions and the owner seed can create and send sandbox invoices.
- **Billing plans and subscriptions:** lists plans and reads identifiable subscription details where the returned transaction data supports them. Existing optional sandbox actions can create a catalog product and billing plan after approval.
- **Payment Links and Buttons:** the flagged set action creates and reads back a payment resource after approval. An owner-only probe can create and delete one £1 test link; its result is not yet verified.
- **Orders v2 and capture readback:** owner-run sandbox seed and verification tools create orders, require sandbox-buyer approval, capture approved orders, and read order/capture status. The seed has not been run as part of this work.

CSV uploads are parsed in the browser. Signed-in sellers can save filtered, pseudonymous rows in encrypted private storage. Names, emails and raw CSVs are not saved; quiet-regular contact details are held only in browser memory for the visit. No PayPal action runs merely by opening results or preparing a review. The application does not send quiet-regular messages, move money, or use live PayPal credentials.

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

The app includes data chat, saved-workspace support and a public synthetic MCP demo. Dedicated WorkOS sign-in and private storage are configured. Real sign-in, session renewal before saving, and persisted assistant-sharing changes have been verified. Both local clients completed OAuth; Codex also reached the private empty workspace and respected the sharing control. Real saved-data, multi-user isolation, client renewal after expiry and Claude private reads remain unverified. Live PayPal daily refresh and billing are not yet operational. A downloadable plugin is not proof of installation or a connected account.

- `/chat` calculates answers from browser-held transaction rows. Its optional AI planner receives the seller's question plus item-title/count inventory and date capabilities, returns a strict validated lookup plan, and never receives buyer data, transaction IDs, or raw rows. When unavailable, a local parser provides a limited fallback.
- `/workspace` keeps local reminders without sign-in. Account storage uses the dedicated WorkOS project and encrypted private store; real sign-in and consent persistence are verified; real saved-analysis and deletion lifecycles remain unverified. Signed-in uploads are filtered into encrypted private records: amounts and item titles are retained, direct identities are stable pseudonymous codes, and the raw CSV is not stored. Assistant workspace access and reviewed-product-label sharing are separate controls and both default off. Turning workspace sharing off blocks the next private assistant request.
- `/connect` offers a downloadable plugin package and a public synthetic sample at `/mcp`. Private OAuth metadata is configured and anonymous private calls require authentication; Codex private access to the empty workspace is verified; Claude private reads and real saved-analysis reads remain unverified. A package download is not an installed or connected client.
- `/billing` exposes the $14.99/month offer after a 30-day Paddle trial that requires a card at checkout. Billing remains off by default; no payment is collected without a configured provider and explicit checkout. The free demo remains unrestricted, and judges can use the access code above.
- Live merchant PayPal access and daily refresh are not activated. The read-only transport and atomic snapshot orchestration require an approved merchant grant, secure storage and a configured daily job. The sandbox login matches only the demo merchant; CSV upload remains available for a seller’s own data.

See `docs/workspace.md`, `docs/data-chat.md`, `docs/plugin.md`, `docs/live-paypal.md` and `docs/billing.md` for exact configuration and verification boundaries. Never reuse another product's provider credentials.

The current application release is `d39fe1c` on deployment `dpl_7oNnpqPxYHx9LkPxV8eaapf7vo19`; the hosted build passed 175 tests. This release fixes the WorkOS web-session issuer and renews sessions before workspace changes. To authorize the already configured local clients, the owner can run `codex mcp login wtes-private --scopes summaries:read,offline_access` or `claude mcp login wtes-private`. Verify each client and the workspace sharing setting before relying on private results.
