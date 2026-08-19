#!/usr/bin/env node
// Amazon referral fee calculator.
//
// Handles the three structures Amazon actually uses:
//   flat         one rate on the whole price
//   whole_price  bracket selects a rate, that rate applies to the whole price
//   marginal     each bracket's rate applies only to its slice of the price
//
// The whole_price / marginal distinction is the point of this file. Every
// flat-rate calculator we examined gets tiered categories wrong, in both
// directions: overstating fees on cheap apparel and understating them on
// expensive jewelry.
//
// Usage:
//   node lib/referral-fee.mjs apparel 30
//   node lib/referral-fee.mjs jewelry 400
//   node lib/referral-fee.mjs electronics 250 --compare-flat 0.15

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = JSON.parse(
  readFileSync(join(HERE, '..', 'corpus', 'amazon-us.json'), 'utf8')
);

const REF = CORPUS.referral_fees;
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * @param {string} category
 * @param {number} price  total sales price (item + shipping + gift wrap)
 * @returns {{ fee:number, rate_applied:number|null, mode:string, minimum_applied:boolean, breakdown:Array, confidence:string }}
 */
export function referralFee(category, price) {
  if (!(price >= 0)) throw new TypeError(`price must be a non-negative number, got ${price}`);

  const tiered = REF.tiered[category];
  let fee, rateApplied = null, mode, breakdown = [], confidence = 'n/a';

  if (tiered) {
    mode = tiered.mode;
    confidence = tiered._mode_confidence ?? 'unstated';

    if (mode === 'whole_price') {
      const bracket = tiered.brackets.find(b => b.up_to_usd == null || price <= b.up_to_usd);
      rateApplied = bracket.rate;
      fee = price * bracket.rate;
      breakdown.push({ slice: price, rate: bracket.rate, amount: round2(fee) });

    } else if (mode === 'marginal') {
      fee = 0;
      let floor = 0;
      for (const b of tiered.brackets) {
        const ceil = b.up_to_usd ?? Infinity;
        if (price <= floor) break;
        const slice = Math.min(price, ceil) - floor;
        const amount = slice * b.rate;
        fee += amount;
        breakdown.push({ slice: round2(slice), rate: b.rate, amount: round2(amount) });
        floor = ceil;
      }

    } else {
      throw new Error(`unknown tier mode "${mode}" for category "${category}"`);
    }

  } else {
    mode = 'flat';
    rateApplied = REF.flat[category] ?? REF.flat.default;
    if (!(category in REF.flat)) {
      confidence = `category "${category}" not in corpus — fell back to default ${rateApplied}`;
    }
    fee = price * rateApplied;
    breakdown.push({ slice: price, rate: rateApplied, amount: round2(fee) });
  }

  const min = REF.minimum_referral_fee_usd;
  const minimumApplied = fee < min && price > 0;

  return {
    fee: round2(minimumApplied ? min : fee),
    rate_applied: rateApplied,
    mode,
    minimum_applied: minimumApplied,
    breakdown,
    confidence,
  };
}

/** What a naive flat-rate calculator would have reported. The gap is the finding. */
export function flatRateError(category, price, flatRate) {
  const actual = referralFee(category, price);
  const naive = round2(price * flatRate);
  return {
    actual: actual.fee,
    naive,
    overstated_by: round2(naive - actual.fee),
    ...actual,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());

if (isMain) {
  const args = process.argv.slice(2);
  const category = args[0];
  const price = Number(args[1]);
  const ci = args.indexOf('--compare-flat');
  const flat = ci !== -1 ? Number(args[ci + 1]) : null;

  if (!category || Number.isNaN(price)) {
    console.error('usage: node lib/referral-fee.mjs <category> <price> [--compare-flat <rate>]');
    console.error(`categories: ${[...Object.keys(REF.tiered), ...Object.keys(REF.flat)].filter(k => !k.startsWith('_')).join(', ')}`);
    process.exit(1);
  }

  const r = flat != null ? flatRateError(category, price, flat) : referralFee(category, price);

  console.log('');
  console.log(`  ${category} @ $${price.toFixed(2)}`);
  console.log(`  mode       ${r.mode}`);
  for (const b of r.breakdown) {
    console.log(`             $${b.slice.toFixed(2).padStart(8)} @ ${(b.rate * 100).toFixed(0).padStart(2)}%  =  $${b.amount.toFixed(2)}`);
  }
  console.log(`  fee        $${r.fee.toFixed(2)}${r.minimum_applied ? `  (raised to $${REF.minimum_referral_fee_usd} minimum)` : ''}`);
  if (flat != null) {
    console.log(`  flat model $${r.naive.toFixed(2)}  → overstates by $${r.overstated_by.toFixed(2)}/unit`);
  }
  console.log(`  confidence ${r.confidence}`);
  console.log('');
}
