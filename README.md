# Will This Ever Scale

Will This Ever Scale is a money tool for hobby sellers who take payments through PayPal. It builds a picture of the shop's numbers from PayPal or a sales file, asks for costs PayPal cannot know, and suggests what to do next and what it could mean in money. For supported actions, the seller reviews and approves the PayPal step. Built for the PayPal AI Hackathon; PayPal connections and actions use the sandbox only.

## For judges (about 3 minutes)


1. Open https://app.willthiseverscale.com/judge, enter the access code `PAYPAL-JUDGE-2026` and choose **Unlock everything**. Judge access lasts until 15 December 2026. (On the start screen this is the **Judge? Enter your code** link.)
2. Choose **Open the demo shop**. No PayPal login is needed. It opens a snapshot of the demo seller's PayPal sandbox: 153 orders from November 2025 to November 2026.
3. At the top of the results, **Your shop's numbers** shows what PayPal filled in (sales, fees and refunds, what reached the seller, buyers) and what only the seller knows ("not yet"). Tap **Use example answers** to fill the seller's half in one tap: the result is about $30.65 kept on a necklace order.
4. On **6 people haven't paid you yet** ($1,080), choose **Remind them in PayPal**, review the six invoices and what PayPal sends, then tap **Approve · send 6 reminders from PayPal**. The sandbox sends PayPal's standard invoice reminders. Demo actions have daily limits.
5. On **Bought together** (Hoops and Rings), choose **Make the set in PayPal**, then **Approve** to create a sandbox payment link for the set.
6. Open **Ask your data** (link at the bottom of the results page, or https://app.willthiseverscale.com/chat). Tap **Best seller** or **Sales last month**, or type a question such as "How much did I make in the latest completed month?".
7. To answer the cost questions yourself, choose **Check the real cost** on the **Your best sellers** card, then **Type instead**. Every number is read back before it is used.
8. Optional: on the start screen choose **Upload a sales file instead**, download **No file handy? Try the sample file**, then **Choose your CSV file**. The file is also at [`public/sample-paypal-activity.csv`](public/sample-paypal-activity.csv).

## Connect PayPal

**Connect PayPal** logs in with PayPal and reads the demo seller's sandbox account; the video shows it end to end. Reading another seller's PayPal needs PayPal partner permission, so the demo shop and the judge code above cover everything a judge can test.

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
