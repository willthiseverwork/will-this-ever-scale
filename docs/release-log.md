# Release log

- 2026-11-02T12:04:36Z — `cf01b29` — Fixed B1–B5: correctly labels a five-point returning-buyer test, preserves all-caps item prefixes, renames the refunds finding, reads PayPal `Subject`, and applies one date order per PayPal file. Updated the upload guidance. Check `/` and upload a UK/US PayPal activity CSV; local fixture coverage is in `tests/csv.test.ts` and `tests/display.test.ts`.
