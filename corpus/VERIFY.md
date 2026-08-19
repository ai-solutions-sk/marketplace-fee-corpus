# Verification protocol

The corpus is the moat. Its value is not that the numbers are impressive — it is
that a reader can tell, for any single figure, where it came from and when.

Nearly every published e-commerce fee table we examined fails this. The common
pattern is a hardcoded flat rate with no date, no source, and no tiering — so
the apparel figure goes wrong the first time Amazon restructures a bracket, and
nothing in the file can reveal that it has. The table keeps returning a number,
confidently, forever.

That is the failure mode this document exists to prevent in our own work. It is
easy to be smug about it and hard to avoid; the only defence is a protocol that
makes staleness visible.

## The rule

> No figure carrying `source_tier: "secondary"` may appear in a client-facing
> deliverable until it has been re-verified against a primary source and
> promoted.

Secondary figures are fine for internal computation, for deciding where to
look, and for prospecting shortlists. They are not fine in something someone
paid for.

## Source tiers

| Tier | Means | Client-safe |
|---|---|---|
| `primary` | Read directly off Amazon Seller Central's rate card or an official policy page | Yes |
| `secondary` | Reputable third-party aggregator | No |
| `inferred` | Derived from other corpus fields | No |

## Promoting a figure to primary

1. Open the relevant Seller Central page while signed in to a seller account.
2. Copy the figure exactly. Do not round, do not normalise, do not "clean up".
3. Record in the corpus entry:
   - `_source_tier: "primary"`
   - `_sources`: the Seller Central URL
   - `_retrieved`: today's date, ISO
   - `effective_from`: the date Amazon states the rate takes effect, when given
4. If the primary value **differs** from what we held, do not silently
   overwrite. Add a `_corrected_from` field recording the old value and the
   date. Drift is the thing we are selling visibility into; hiding our own is
   self-defeating.

## Open items, highest risk first

- [ ] **Peak 2026 rate card** (2026-10-15 to 2027-01-14). Not captured, and peak
      starts roughly eight weeks from now. Every fulfillment figure we quote
      goes stale on 15 October.
- [ ] Dangerous-goods rate card; Large standard above 2.75 lb; all bulky and
      extra-large tiers; the Low-Price FBA programme card.
- [ ] Small Bulky / Large Bulky dimensional boundaries after the 2026-01-15
      split. `lib/size-tier.mjs` refuses to classify into these on purpose.
- [ ] Per-category minimum referral fee overrides.
- [ ] Media closing fee — historically $1.80/unit on books, DVDs, music.
      Unconfirmed for 2026.
- [ ] Categories above 20% referral (range reportedly extends to 45%).
- [ ] The reported 20–30% shortfall on Amazon's substituted manufacturing-cost
      estimates is widely repeated by seller-tooling vendors but not
      independently measured. Always present as "reported to run 20–30% low",
      never as a hard figure.

## Review cadence

| Trigger | Action |
|---|---|
| Quarterly | Re-read the referral rate card end to end |
| Amazon announces a fee change | Same week, before the effective date |
| Any figure older than 6 months | Demote to `secondary` until re-read |
| Before onboarding a category | Verify every figure that category touches |

Referral percentages were frozen across 2025 and 2026, which makes them the
most stable numbers here. Fulfillment fees moved twice in 2026 alone
(2026-01-15 increases, 2026-04-17 surcharge). Weight the cadence accordingly.

## Resolved

| Date | Item | Outcome |
|---|---|---|
| 2026-08-20 | FBA base fulfillment rates | Captured primary off the Seller Central 2026 rate card (`GABBX6GZPA8MSZGW`) into `corpus/amazon-us-fba-fees.json` — both the standard and apparel cards, small and large standard, all three price bands, non-peak. This unblocks pricing a size-tier miss: previously we could name the boundary but not what clearing it was worth. A 14oz apparel unit at $20.95 saves **$1.00/unit** including the 3.5% surcharge. Note a signed-in Seller Central account reaches these help pages even when the business is unverified; the Revenue Calculator does not. |
| 2026-08-19 | `apparel.mode` / `jewelry.mode` | Confirmed against `sell.amazon.com/pricing` (primary). Apparel is `whole_price` — "products with a total sales price"; jewelry is `marginal` — "portion of the total sales price". Two structures, one table, distinguished only by wording. Our inferred value was correct; both promoted to `primary` with verbatim quotes recorded. |
