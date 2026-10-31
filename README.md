# Will This Ever Scale

A plain-language money map for hobby sellers using PayPal. It reads sample or uploaded PayPal activity, keeps raw files in the browser, and sends only calculated totals to Claude when AI wording is enabled.

## Judge path

1. Open the hosted app and select **Try the demo shop**.
2. Read the money map, the ranked monthly leaks, and the unpaid-invoice quick win.
3. Upload `public/sample-paypal-activity.csv` to see the same client-side parser path.

## Local setup

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

`ANTHROPIC_API_KEY` is optional. Without it, the app uses a deterministic, number-traceable read. PayPal sandbox credentials are server-only and are not committed. The live sandbox adapter is intentionally held behind those credentials; no live account is connected in this repository.

## How the math works

The engine is shared TypeScript (`lib/engine.ts`). Gross sales minus exact payment fees, refunds/reversals/disputes, optional per-item costs, and optional monthly ad spend equals “you kept.” It uses the dominant currency only, lists other currencies as excluded, and never lets the model compute a displayed number. The tests include a three-month fixture calculated by hand and reject an AI sentence containing a number not present in the engine JSON.

## PayPal sandbox setup

Create a sandbox REST app in [PayPal Developer](https://developer.paypal.com/), enable Transaction Search and Invoicing, and set `PAYPAL_SANDBOX_CLIENT_ID` and `PAYPAL_SANDBOX_CLIENT_SECRET` in the Vercel project. These values must be Production environment variables, server-only, and must never be copied to the browser or repo. New sandbox transactions can take time to reach Transaction Search.

## License

MIT. Add the repository topic/license/About details on GitHub after creating the public repository.
