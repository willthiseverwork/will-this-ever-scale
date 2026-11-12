# Will This Ever Scale

Will This Ever Scale is a money tool for hobby sellers who take payments through PayPal. It builds a picture of the shop's numbers from PayPal or a sales file, asks for costs PayPal cannot know, and suggests what to do next and what it could mean in money. For supported actions, the seller reviews and approves the PayPal step. Built for the PayPal AI Hackathon; PayPal connections and actions use the sandbox only.

## For judges (about 3 minutes)

1. Open https://app.willthiseverscale.com/judge, enter the access code `PAYPAL-JUDGE-2026` and choose **Unlock everything**. The app is normally paid; the code is a free pass until 15 December 2026. (On the start screen this is the **Judge? Enter your code** link.)
2. **Try different shops.** On the start screen choose **Upload a sales file instead**, then upload any PayPal activity CSV: your own PayPal export, or one of the five sample shops in [`sample-files/`](sample-files/) (download a file, then choose it). Each shop gets its own numbers, best sellers and cards. Nothing is hardcoded. You can upload several files from the same shop together.
3. **Or open the demo shop** for the full PayPal side: choose **Open the demo shop**. No PayPal login is needed. It opens a snapshot of the demo seller's PayPal sandbox: 153 orders from November 2025 to November 2026.
4. In the demo shop, at the top of the results, **Your shop's numbers** shows what PayPal filled in (sales, fees and refunds, what reached the seller, buyers) and what only the seller knows ("not yet"). Tap **Use example answers** to fill the seller's half in one tap: the result is about $30.65 kept on a necklace order.
5. In the demo shop, on **6 people haven't paid you yet** ($1,080), choose **Remind them in PayPal**, review the six invoices and what PayPal sends, then tap **Approve · send 6 reminders from PayPal**. The sandbox sends PayPal's standard invoice reminders. Demo actions have daily limits.
6. On **Bought together** (Hoops and Rings), choose **Make the set in PayPal**, then **Approve** to create a sandbox payment link for the set.
7. Open **Ask your data** (link at the bottom of the results page, or https://app.willthiseverscale.com/chat). Tap **Best seller** or **Sales last month**, or type a question such as "How much did I make in the latest completed month?".
8. To answer the cost questions yourself, choose **Check the real cost** on the **Your best sellers** card, then **Type instead**. Every number is read back before it is used.

## Sample shops to upload

All five are made-up hobby shops: buyer names and emails are fake (`example.com` / `example.test`). Money is GBP.

| File | What it is | Rows | Period |
|---|---|---|---|
| [`jewellery-maker.csv`](sample-files/jewellery-maker.csv) | Handmade jewellery maker (necklaces, rings) | 183 | 12 months |
| [`toy-shop-3-months.csv`](sample-files/toy-shop-3-months.csv) | Small toy shop with only 3 months of sales | 26 | 3 months |
| [`candle-shop.csv`](sample-files/candle-shop.csv) | Candle and T-light holder shop, 40 orders | 42 | 12 months |
| [`stationery-shop.csv`](sample-files/stationery-shop.csv) | Stationery shop, 250 orders | 259 | 12 months |
| [`christmas-decor-paypal-layout.csv`](sample-files/christmas-decor-paypal-layout.csv) | Christmas decorations with a strong season, in PayPal's own 22-column activity export layout | 2,485 | 12 months |

The four shops other than the jewellery maker use real retail order patterns from Chen, D. (2012), *Online Retail II* [Dataset], UCI Machine Learning Repository, https://doi.org/10.24432/C5CG6D (CC BY 4.0), turned into fictional PayPal activity. The jewellery maker is fully synthetic.

## Connect PayPal

**Connect PayPal** uses Log in with PayPal (sandbox). Reading a seller's own PayPal data needs PayPal partner approval, so for now Connect PayPal works only for our demo sandbox seller, whose login isn't shared. To check the app on any shop, upload a PayPal activity CSV (above); for the PayPal actions, use the demo shop.

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

For grouping, the model receives item titles and order counts. Chat planning receives the question, item titles and counts, and date capabilities. The cost interview can send the spoken or typed answer, the current question, item and cost context; voice audio goes to Transcribe and reply text to Polly. These requests are designed not to include buyer names, emails or raw transaction rows. Avoid putting personal information in a question or answer.

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
