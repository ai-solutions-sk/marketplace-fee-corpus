# Margin corpus

Dated, sourced, versioned marketplace fee reference — and the calculators that
read it.

Most published e-commerce fee tables are undated, uncited, and flat. They are
wrong within a year and nothing in the file reveals it. This corpus makes
provenance a first-class field so a stale rate is visible instead of invisible.

## What's here

| Path | |
|---|---|
| `corpus/amazon-us.json` | Referral fees, FBA size tiers, 2026 fee changes, reimbursement policy |
| `corpus/VERIFY.md` | Verification protocol and open items |
| `lib/size-tier.mjs` | FBA size-tier classifier + boundary-proximity finder |
| `lib/referral-fee.mjs` | Referral fee calculator (flat / whole-price / marginal) |
| `lib/dead-zone.mjs` | Price bands where raising your price lowers your net |
| `lib/tier-saving.mjs` | What clearing an FBA size-tier boundary is actually worth |
| `corpus/amazon-us-fba-fees.json` | 2026 FBA fulfillment rate card, non-peak, standard + apparel |

## Use

```bash
node lib/size-tier.mjs 12.3 9.1 0.9 14        # sides in inches, weight in oz
node lib/referral-fee.mjs jewelry 400 --compare-flat 0.20
node lib/dead-zone.mjs apparel 20.99          # is this price costing you money?
node lib/tier-saving.mjs 14 20.95 --apparel   # what is the tier boundary worth?
```

## The two things most calculators get wrong

**Tier boundaries.** A carton 0.15in over the 0.75in shortest-side limit pays
Large standard instead of Small standard, on every unit, permanently. For a
14oz apparel item at $20.95 that is **$1.00/unit** including the surcharge —
$5.35 against $4.35.

**Tiered referral modes.** Amazon runs two structures and distinguishes them
only by wording. Apparel re-rates the *whole price* by bracket; jewelry is
genuinely *marginal*. A flat-20% jewelry model overstates a $400 piece by
$22.50 per unit.

## Dead zones

Because apparel re-rates the whole price at a bracket boundary, there are bands
where charging more earns less:

```
Grocery & Gourmet         $15.01 – $16.22    worse than $15.00   max -$1.04
Clothing & Accessories    $20.01 – $21.68    worse than $20.00   max -$1.39
                          $15.01 – $15.82    worse than $15.00   max -$0.74
Beauty, Health & Personal $10.01 – $10.81    worse than $10.00   max -$0.69
Baby Products             $10.01 – $10.81    worse than $10.00   max -$0.69
```

Those four are the complete set. Every other tiered category on Amazon's rate
card — Furniture, Watches, Compact Appliances, Electronics Accessories,
Jewelry — is *marginal*, so net revenue rises monotonically and no dead zone
can exist. Lawn Mowers & Snow Throwers is whole-price but the rate *drops* at
$500, which is a cliff in the seller's favour rather than a leak.

**Check the category, not the shelf.** The Amazon browse department a product
appears under is *not* its referral category. Headbands returned by a search in
the fashion department routinely classify under Beauty, Health & Personal Care
— different brackets, different dead zone, or none at your price. Breadcrumb
and page title can also disagree with each other. Verify per ASIN before
trusting any figure.

`$20.99` — one of the most common price points in retail — nets **$0.58/unit
less** than `$20.00`. An apparel seller sitting anywhere in those bands is
paying for the privilege. Marginal categories like jewelry have no dead zones
by construction, which is the practical reason the mode distinction matters.

## Status

Corpus v0.2.0. Referral rates and FBA fulfillment rates are `source_tier:
primary` — read off Amazon's own rate cards with verbatim quotes recorded. Size
tier *boundaries* remain `secondary`. See `corpus/VERIFY.md` before using any
figure in client work.

Fulfillment rates are **non-peak** and valid to 2026-10-14. Peak rates
(2026-10-15 to 2027-01-14) are not yet captured.
