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

## Use

```bash
node lib/size-tier.mjs 12.3 9.1 0.9 14        # sides in inches, weight in oz
node lib/referral-fee.mjs jewelry 400 --compare-flat 0.20
node lib/dead-zone.mjs apparel 20.99          # is this price costing you money?
```

## The two things most calculators get wrong

**Tier boundaries.** A carton 0.15in over the 0.75in shortest-side limit pays
Large standard instead of Small standard, on every unit, permanently.

**Tiered referral modes.** Amazon runs two structures and distinguishes them
only by wording. Apparel re-rates the *whole price* by bracket; jewelry is
genuinely *marginal*. A flat-20% jewelry model overstates a $400 piece by
$22.50 per unit.

## Dead zones

Because apparel re-rates the whole price at a bracket boundary, there are bands
where charging more earns less:

```
$15.01 – $15.82   worse than pricing at $15.00
$20.01 – $21.68   worse than pricing at $20.00
```

`$20.99` — one of the most common price points in retail — nets **$0.58/unit
less** than `$20.00`. An apparel seller sitting anywhere in those bands is
paying for the privilege. Marginal categories like jewelry have no dead zones
by construction, which is the practical reason the mode distinction matters.

## Status

Corpus v0.1.0. Every figure is currently `source_tier: secondary` — good enough
to prospect with, not good enough to invoice against. See `corpus/VERIFY.md`
before using any of it in client work.
