# PayPal and voice takeover record

Deployment IDs and production checks are recorded in `docs/release-log.md`. A local commit and a passing build do not prove the corresponding live journey.

## B4: payment-link probe

Local commit `9f506b6`. The owner-only sandbox probe reserves one attempt, creates a £1 test resource and deletes it; it stops after an uncertain write. `npm test` passed 234 tests, the standalone probe tests passed 2 tests, and `npm run build` passed. No customer-facing strings were added. The actual PayPal probe is unrun because the route secret and sandbox credentials are unavailable to the runner. Payment-link availability remains unknown and the set feature must remain gated.

With sandbox credentials in the environment, run `node scripts/probe-payment-link.mjs --confirm --receipt /absolute/private/path/new-probe-receipt.json`. Alternatively, the deployed route needs a private random `WTES_PAYMENT_LINK_PROBE_SECRET` of at least 32 bytes and the existing private Blob store. See `docs/paypal.md` for safe use and uncertainty handling.

## A1–A4: connection and storage

Local commits `6694085` and `214d00d`. Connect uses sandbox Log in with PayPal and a signed state cookie, matches only the configured demo merchant, and retains the existing access gate. Connected results can be saved as pseudonymous upload rows. The fallback opens the keys form if login configuration is absent; the demo falls back to the local sample if the sandbox fails. The completion path refreshes and rechecks account status and discards stale navigation. The isolated build passed 240 tests, including state mismatch, cancellation, payer ID and verified-email matching, non-match, upload privacy, and late account refresh. Live login and visual checks are pending. Checklist values are displayed after the sandbox response, rather than streaming the individual PayPal requests.

Customer strings introduced or changed: “Find where your shop loses money, and how to fix it.”; “Takes a minute.”; “Connect PayPal”; “We never move money.”; “What the demo shop found”; “Open this demo shop”; “Rather not log in? Upload your sales file”; “Developer? Use sandbox keys”; “PayPal connected”; “Going through your PayPal”; “couldn’t get this”; “No sales in this PayPal yet. New sales can take up to 3 hours to show up.”; “PayPal couldn’t get your sales. Try again or open the demo shop.”; “PayPal didn’t finish the login. Nothing was connected.”; “You’re logged in to PayPal … but we can’t see this test account yet.”; “PayPal’s test system didn’t answer, so this is our sample shop.”; “PayPal login expired. Connect again.”

## A5: generated history and seed

The A5 build passed 249 tests, including an overlap fixture and seed safety tests. The script has not been run. It requires 40 buyer approvals in the sandbox; the subsequent capture phase validates each intended buyer and amount. Its invoice phase creates and sends three test invoices. Run the commands in `docs/paypal.md` at least three hours before filming. The generated fixture ends 2026-11-02; regenerate with the day before the earliest seeded sale using `node --import tsx scripts/generate-hobby-shop.ts --demo-history --end-date YYYY-MM-DD --seed 7`. The seed and actual sandbox history remain unverified. No customer-facing strings were added. Userinfo field-name observation now stops at 2026-11-10 00:00 UTC; a boundary test verifies that no names are emitted afterwards.

## B3: bought-together set

The set is calculated from actual same-order pairs and median single-item prices. A proposed sandbox payment link has two line items, is bound to a five-minute signed approval, and requires readback; uncertain writes are not retried. The create button remains gated by `WTES_PAYPAL_SET_LINK_ENABLED` because the actual B4 sandbox probe has not run. Do not set that flag until the probe succeeds. The B3 follow-up build passed 254 tests, including selected-currency pair selection, price-dependent gain, a two-item payload, buyer-data exclusion, and PayPal cart normalization. The corrected seed creates eight paired sales among its 40 orders; it remains unrun. Incomplete or cross-currency cart details are excluded rather than guessed. Real PayPal acceptance and rendering remain unverified.

Customer strings: “Bought together”; “in sales”; “if 1 in 10 people who buy only … take the set.”; “… buyers already picked … together.”; “for the set, … off”; “Connect PayPal to make the set”; “Make the set in PayPal”; “You get one link to post anywhere. Buyers pay with PayPal.”; “Create a PayPal link for … at … for the set.”; “Approve”; “Your set is ready in PayPal”; “Copy link”; “Open in PayPal”; “Choose a higher set price.”; “PayPal didn’t confirm the link. Check PayPal before trying again.”; “Payment links are unavailable.”; “Set: …”.

## B2: offers to quiet regulars

The offer flow prepares editable free-postage or 10%-off messages locally and opens a seller-controlled email draft. It does not send messages. PayPal quiet-contact names and emails are returned only in the current response and held in browser memory; CSV contacts are extracted in the browser. The offer date and pseudonymous buyer codes are stored on the device to support a later comparison; a random browser key keeps anonymous CSV codes consistent. The privacy page describes this. The 260-test build covered both message variants, date and name substitution, return calculations, CSV parsing and quiet-only sandbox contact extraction. Live interaction and visual checks remain pending.

To avoid storing buyer names from the sandbox response, later follow-up identifies returned people as the numbered “Regular 1”, etc., shown alongside their names at preparation time. This means the seller needs that association to recognise someone after a new session; live testing should check whether this is sufficient for the intended experience.

Customer strings: “Regulars gone quiet”; “if these … regulars order one more time.”; “They used to order every … to … weeks. None has since ….”; “Regular …”; “Send them an offer”; “… regulars gone quiet”; “What would bring them back?”; “Free postage”; “costs you one postage”; “costs you about … an order”; “10% off”; “Message”; “Same message for …, with their names.”; “Get the … messages”; “Send them today, from your own email or Instagram.”; “Copy”; “Email”; “We’ll watch your PayPal for their orders.”; “On … you’ll see who came back and what it brought.”; “No regulars came back”; “… came back · … in sales.”; “Reconnect your sales to see these buyers.”; “Offer to quiet regulars”. The message starts “Hi {name}, it’s been a while!” and offers free postage or 10% off with code BACK by the date 28 days later, followed by “Thank you for shopping with me.”

## B1: reminder review and done styling

The existing invoice reminder review and completion card use the approved dark card, ruled invoice rows, inset message and full-width lime action styling. The proposal, approval, dispatch, stop and readback logic are unchanged. Build passed 260 tests. No customer strings were added. Rendered and live checks remain pending.

The B2 follow-up is restricted to the selected currency and the 28-day offer window. It requires a same-currency observation at or beyond the deadline; stale data displays “Reconnect or upload newer sales to see who came back.” This conservative observation does not prove full provider coverage.

## C engine and typed interview

The typed interview now proposes candidates, runs code sense checks and requires an explicit readback confirmation before an answer enters the calculation. Skipped fields are listed as not counted. The code preserves `costResult` maths; both seller types are asked for pay per order, resolving the older maker question that said per piece while the calculation treated pay per order. The build passed 270 tests, including the 104-units ambiguity, invalid ranges, wrong-number readback and sense-check cases. Voice integration, model calls, all-field live checks and rendering remain pending.

Customer strings added: “Checking this one”; “Please give a valid number.”; “Is that for one item or all of them?”; “That looks low for all of them. Is that amount for the whole quantity?”; “Which amount is that for?”; “That is more than the price of one item. Is it right?”; “That is more than half an average order. Is it right?”; “Is more than 90% of the batch wasted?”; “That is more than an average order. Is it right?”; “So it costs you nothing?”; “That looks low for each item. Is that batch size right?”; “That makes materials cost more than the price of one item. Is the batch size right?”; “For one …”; “For all …”; “Yes, that’s right”; “Change the number”; “Skip this one”; “Not counted”; “Not counted: … Add it to see the full picture.”; “Change a number”; “So …, is that right?”; “Do you pay yourself for making an order? About how much per order?”
