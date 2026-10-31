# Will This Ever Scale

A plain-language money map for sellers using PayPal. The sample shop is synthetic. Uploaded CSV files are parsed and analyzed in the browser. If the seller requests an AI read, only a strict set of numeric totals and fixed finding IDs is sent; no transaction rows or item names are sent in that request.

## Try it

Production: [app.willthiseverscale.com](https://app.willthiseverscale.com). The plain interface is for testing the pipeline; the approved visual design follows separately.

1. Select **Try the demo shop** and inspect the money map and ranked findings.
2. Answer the questions for the top finding and choose a test. Some tests cannot be filled when the source data lacks the required evidence; the app reports that gap.
3. In Sandbox actions, choose sample invoice `INV-0`, select **Review action**, then explicitly approve the reminder. The server maps it to a real sandbox invoice and shows the response. The three demo invoices total USD 540. No sign-in is needed for this demo action. Download and upload the sample CSV to exercise the browser parser; the optional sandbox connection lets developers use their own credentials.

## Run locally

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

The app uses deterministic wording when the configured AI provider is unavailable. Amazon Bedrock is the default (`AI_PROVIDER=bedrock`). The intended reviewed production configuration uses `AWS_BEDROCK_REGION=us-east-1`, inference profile `AWS_BEDROCK_MODEL=us.amazon.nova-2-lite-v1:0`, and production-only Vercel OIDC with `WTES_BEDROCK_AUTH=vercel_oidc` and the explicitly scoped `WTES_BEDROCK_ROLE_ARN`. The role and its model permissions must be configured separately; the app does not grant them. OIDC rejects static credentials. Other supported setups can use either `WTES_BEDROCK_API_KEY` or `WTES_BEDROCK_ACCESS_KEY_ID` and `WTES_BEDROCK_SECRET_ACCESS_KEY` with an optional session token, but must not mix credential types. Direct Anthropic access is optional and separate.

The previously attempted Sonnet 5.5 invocation returned AccessDenied; the newly approved Nova 2 Lite route has not yet been verified with a successful production model response. A role or configured profile alone does not establish model access or credit attribution. Live AI remains gated by a verified external production rate limit and `AI_RATE_LIMIT_ENFORCED=true`; a flag alone does not provide protection. Demo wording never invokes the model: it uses a reviewed static AI read only when its aggregate matches exactly, otherwise the deterministic template. Output is checked against the numeric aggregate and falls back to the template when unavailable or invalid.

## Data and APIs

- `POST /api/analyze`: accepts `{source:"demo"}`, `{source:"aggregate", aggregate:...}`, or `{source:"grouping", descriptors:[...]}` validated by the strict aggregate or descriptor schema. Aggregate and demo reads return `{read, read_source, suggestions}`; grouping returns `{mappings, source}`. `read_source` distinguishes a validated model read, a reviewed cached sample read, and the deterministic template; suggestions identify whether the model selected them or the template generated them. Suggestions cannot execute actions. CSVs, rows, names and free-text item labels are rejected. The browser owns CSV calculation and retains the full analysis locally.
- `POST /api/questions`: accepts a fixed `leakId` and returns questions from the bundled playbook. The browser evaluates the selected test using `questionsFor`, `contextFor`, and `testFor`; the retired `POST /api/test` returns 410. A missing target is an explicit gap, not a guessed answer.
- `POST /api/sandbox/connect` and `/api/sandbox/analyze`: connect and read a PayPal sandbox. Credentials are held in server memory for the session and can be lost on instance changes. Sandbox coverage and unavailable endpoints are returned separately. The app does not connect a live PayPal account.
- `POST /api/actions/propose` and `/api/actions/execute`: sandbox-only actions require a review and separate approval. Approved actions can send sandbox invoice notifications. A signing secret and sandbox credentials are required; never commit them.
- `POST /api/reminders`: validates an email, date and playbook ID, then stores them in a private Blob when configured. **Email delivery is not configured**; a saved record is not a sent reminder. The browser can instead generate a local calendar file without providing an email.

Opt-in Google Analytics is restricted to the canonical production host, using fixed control IDs and sanitized origin/path. Values entered into forms and uploaded data are not sent as event parameters. Live analytics receipt and search indexing require separate production verification.

## Calculation boundaries

See [the formula reference](docs/calculations.md) for every finding, its evidence, and the hand-checked fixtures. Regenerate the synthetic CSV with `node --import tsx scripts/generate-sample-csv.ts`.

The engine selects the dominant sales currency and reports excluded currencies. It calculates gross sales, known payment fees, refunds and supplied costs and ad spend. Missing costs and other coverage gaps are shown separately. Findings are estimates based on explicit assumptions, not verified causes. Unpaid invoice results cover only invoice records supplied or returned by the sandbox; an absence of such records is not proof that no unpaid invoices exist. The playbook retains the supplied source text; target calculations are deterministic and fail when supporting values are missing.

## Sandbox setup

Create a sandbox REST app in [PayPal Developer](https://developer.paypal.com/), enable the required sandbox APIs, and configure server-only `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, and `PAYPAL_ACTION_SIGNING_SECRET`. Use sandbox credentials only. Transaction Search may have reporting delays. The integration and any sandbox action must be verified against the intended sandbox account before claiming a successful action.

For a new installation, seed products and invoices with `scripts/seed-sandbox.ts` using the explicit confirmation flag documented in that script. Keep its durable receipt outside the public repository and inspect ambiguous outcomes before retrying. Set `PAYPAL_SANDBOX_DEMO_INVOICE_IDS` to the three verified invoice IDs in receipt order. The private loopback console in `scripts/seed-console.ts` is for local setup only and is not a deployed route. Captured orders require a separate sandbox buyer approval; the script does not claim to create payment history. PayPal Merchant Insights is not supported in sandbox by the installed Toolkit.

## Current limitations

Live AI remains off after the earlier Bedrock request returned AccessDenied. Nova 2 Lite is the approved next provider test; a successful production invocation and credit attribution remain unverified. Optional AI grouping sends only browser-derived fixed product features, indexes and order counts; titles remain on the device. Unsupported or uncertain titles remain unchanged. The grouping response contains only validated canonical group labels and indexes, and falls back to an empty mapping when unavailable. Action suggestions use fixed, evidence-bound templates while the model is unavailable; a configured model may select from two allowlisted suggestions, never execute them. Item titles and invoice IDs are not sent to the AI. Every PayPal action still requires an explicit approval. Browser/server processes can lose in-memory sandbox sessions or proposals; reconnect or prepare the action again if it expires. No email reminder is sent. Separate fee-only rows, unlinked item refund rates, and complete subscription state need more evidence and are disclosed in the app. See [dependency security](dependencies-security.md) for outstanding upstream advisories and mitigations.

## Sponsor tools used

AG Grid Community powers the money map, item groups and invoice evidence tables. The three sample invoice balances reconcile to USD 540, and the seller chooses one for a separately approved reminder. No commercial grid license is required. The PayPal/APIMatic Context Plugin was used for a new read-only sandbox order and capture verification tool; see [the exact contribution and tests](docs/paypal-server-sdk-context.md). It is not credited for earlier implementation, and no sponsor claim has been submitted.

## License

MIT; see [LICENSE](LICENSE).
