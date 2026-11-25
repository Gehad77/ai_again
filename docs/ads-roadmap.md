# Meta ad performance in Relay

**Status** Deferred until after merchant social messaging is connected.

Add an **Ads** section to each merchant's private dashboard. The first release will report on campaigns already created in Meta Ads Manager. Merchants connect their own ad account and grant Relay read access. Campaign creation and budget management can be considered separately later.

## First release

- Show Meta ad spend alongside the number of attributed conversations, interested conversations, paid orders and sales revenue recorded in Relay. Filter by date and compare ads side by side.
- Save the ad source when Meta provides an identifier alongside an incoming message. Label conversations without a usable identifier as unknown and keep those orders out of per-ad totals. Deduplicate repeated webhook events and count each paid order once.
- Use conversation analysis for buying interest and common objections. Count a purchase only after the linked Relay order is confirmed paid.
- Show cost per paid order as spend divided by attributed paid orders, and return on ad spend as attributed sales revenue divided by spend. Show unavailable values when the denominator is zero or missing. Keep revenue and profit distinct, and compare amounts only with compatible currencies.
- Scope ad accounts, conversations, orders and reports to the merchant's own store. Test with two merchants and with conversations that carry no ad attribution.

Meta permissions and channel-specific referral data must be verified before enabling reporting for merchants.
