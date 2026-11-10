# Will This Ever Scale

Will This Ever Scale is a money tool for hobby sellers who take payments through PayPal. It builds a picture of the shop's numbers from PayPal or a sales file, asks for costs PayPal cannot know, and suggests what to do next and what it could mean in money. For supported actions, the seller reviews and approves the PayPal step. Built for the PayPal AI Hackathon; PayPal connections and actions use the sandbox only.

## For judges (2 minutes)

1. Open https://app.willthiseverscale.com and choose **Open this demo shop**. No login is needed. It opens a shared snapshot of the demo seller's PayPal sandbox; if the snapshot is unavailable, a fictional sample opens instead.
2. To unlock demo PayPal actions and chat, go to **Hackathon judge? Use your access code** on the access screen (or open [the judge page](https://app.willthiseverscale.com/judge)) and enter `PAYPAL-JUDGE-2026`.
3. On the unpaid invoices finding, choose **Remind them in PayPal**, review the reminders and tap **Approve**. PayPal confirms the result when available. Demo actions have daily limits.
4. On the bought-together finding, choose **Make the set in PayPal**, review it and approve the payment link.
5. Open **Ask your data** and try **Most popular product** or **How much did I make in the latest completed month?**
6. In **Ask your data**, choose **Check the real cost** and type your answers. Voice is available when enabled and your browser allows microphone access.
7. Optional: on the start screen, open **Rather not log in? Upload your sales file**, download **No file handy? Try the sample file**, then choose that CSV. The file is also at [`public/sample-paypal-activity.csv`](public/sample-paypal-activity.csv).

Connect PayPal works only with the demo seller's sandbox account; its sandbox login is listed below.

## Sandbox login for Connect PayPal

Email and password: added before submission on 12 Nov.

## How PayPal is used

- **OAuth / Log in with PayPal:** identifies the demo sandbox merchant; login alone does not grant access to another seller's financial data.
- **Transaction Search:** reads sandbox sales and fees for the shop's analysis.
- **Invoicing:** reads unpaid sandbox invoices and sends reviewed, approved reminders.
- **Payment Links and Buttons:** creates a sandbox payment link for an approved set.
- **Catalog products, billing plans and subscriptions:** supports sandbox product/plan actions and reads identifiable subscription details where available.
- **Orders and captures:** owner-run sandbox seed and verification scripts create, capture and check test orders after buyer approval.
- **PayPal Agent Toolkit:** makes fixed, allowlisted sandbox transaction and invoice reads and supported invoice actions, with REST fallbacks where implemented.

Reading a real seller's PayPal requires PayPal partner permission and financial-data access. For now, sellers can upload their own PayPal CSV instead.

## How AI is used

Amazon Bedrock uses Amazon Nova 2 Lite (`us.amazon.nova-2-lite-v1:0`) to group item names and describe what the shop sells, plan chat lookups, and interpret cost-interview answers. Amazon Transcribe handles speech input and Amazon Polly provides spoken replies. Availability depends on configuration and limits; the app has non-AI fallbacks. Application code calculates the figures; AI output is validated and does not determine the calculations.

For grouping, the model receives item titles and order counts. Chat planning receives the question, item titles and counts, and date capabilities. The cost interview can send the spoken or typed answer, the current question, item and cost context; voice audio goes to Transcribe and reply text to Polly. These requests are designed not to include buyer names, emails or raw transaction rows. Avoid putting personal information in a question or spoken answer.

## What's real and what's generated

The shared demo combines a snapshot of the PayPal sandbox with generated earlier months, because sandbox sales cannot be backdated. The sandbox seed captured 40 orders and sent three invoices on 3 November 2026; other sandbox invoices also existed. If the snapshot is unavailable, the app uses a fictional sample. Results and opportunities are estimates, not promises.

## Run it yourself

```sh
npm install
cp .env.example .env.local
npm test
npm run dev
```

Open `http://localhost:3000`. Create a sandbox REST app in the [PayPal Developer dashboard](https://developer.paypal.com/dashboard/applications/sandbox) and put its sandbox client ID and secret in `PAYPAL_SANDBOX_CLIENT_ID` and `PAYPAL_SANDBOX_CLIENT_SECRET`. Configure `PAYPAL_ACTION_SIGNING_SECRET` for actions and the `PAYPAL_LOGIN_*` and `PAYPAL_SANDBOX_DEMO_MERCHANT_*` values for demo-merchant login. Never use live credentials. See [PayPal setup](docs/paypal.md) before seeding or sending anything.

Optional features need their own configuration in [.env.example](.env.example): Bedrock and rate limiting for AI; `WTES_VOICE_ENABLED`, `WTES_VOICE_TALKBACK_ENABLED`, AWS role and storage for voice; WorkOS and session settings for sign-in; a private Blob store and workspace secret for saved data; and dedicated Paddle and billing-store settings for billing. Some AI and voice routes require production Vercel OIDC and will not run locally. See [AI](docs/ai-budget.md), [voice](docs/voice.md), [workspace](docs/workspace.md), and [billing](docs/billing.md).

The offer for a seller's own shop is a free 30-day trial with a card at checkout, then US$14.99 per month; cancel before the trial ends to avoid a charge. Billing requires separate configuration and verification. The demo is free, and judges can use the access code above.

## License

[MIT](LICENSE).
