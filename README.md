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

## Use

```bash
node lib/size-tier.mjs 12.3 9.1 0.9 14        # sides in inches, weight in oz
node lib/referral-fee.mjs jewelry 400 --compare-flat 0.20
```

## The two things most calculators get wrong

**Tier boundaries.** A carton 0.15in over the 0.75in shortest-side limit pays
Large standard instead of Small standard, on every unit, permanently.

**Tiered referral modes.** Amazon runs two structures and distinguishes them
only by wording. Apparel re-rates the *whole price* by bracket; jewelry is
genuinely *marginal*. A flat-20% jewelry model overstates a $400 piece by
$22.50 per unit.

## Status

Corpus v0.1.0. Every figure is currently `source_tier: secondary` — good enough
to prospect with, not good enough to invoice against. See `corpus/VERIFY.md`
before using any of it in client work.
