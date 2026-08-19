#!/usr/bin/env node
// What a size-tier boundary miss actually costs.
//
// lib/size-tier.mjs can say "you are 0.15in over the Small standard limit".
// This file says what that is worth, using the primary rate card in
// corpus/amazon-us-fba-fees.json.
//
// Usage:
//   node lib/tier-saving.mjs 14 20.95 --apparel     # weight oz, price, rate card
//   node lib/tier-saving.mjs 14 20.95

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FBA = JSON.parse(readFileSync(join(HERE, '..', 'corpus', 'amazon-us-fba-fees.json'), 'utf8'));

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

/** Sale price → rate-card price band. */
export function priceBand(price) {
  if (price < 10) return 'lt_10';
  if (price <= 50) return '10_to_50';
  return 'gt_50';
}

// Upper bound in ounces for each band key, in table order.
const SMALL_BANDS = [
  ['2oz_or_less', 2], ['2_to_4oz', 4], ['4_to_6oz', 6], ['6_to_8oz', 8],
  ['8_to_10oz', 10], ['10_to_12oz', 12], ['12_to_14oz', 14], ['14_to_16oz', 16],
];
const LARGE_BANDS = [
  ['4oz_or_less', 4], ['4_to_8oz', 8], ['8_to_12oz', 12], ['12_to_16oz', 16],
  ['1_to_1.25lb', 20], ['1.25_to_1.5lb', 24], ['1.5_to_1.75lb', 28],
  ['1.75_to_2lb', 32], ['2_to_2.25lb', 36], ['2.25_to_2.5lb', 40],
  ['2.5_to_2.75lb', 44],
];

function bandFor(bands, oz) {
  for (const [key, max] of bands) if (oz <= max) return key;
  return null;
}

/**
 * Base fulfillment fee for a unit. Surcharge excluded — see `withSurcharge`.
 * @returns {{ fee:number, band:string }|null} null when the weight is beyond captured bands.
 */
export function fulfillmentFee({ tier, weightOz, price, card = 'standard' }) {
  const table = FBA.non_peak_2026[card]?.[tier];
  if (!table) throw new Error(`no rate card for ${card}/${tier}`);
  const band = bandFor(tier === 'small_standard' ? SMALL_BANDS : LARGE_BANDS, weightOz);
  if (!band || !table[band]) return null;
  return { fee: table[band][priceBand(price)], band };
}

/** Apply the 3.5% fuel and logistics surcharge in force since 2026-04-17. */
export function withSurcharge(fee) {
  return round2(fee * (1 + FBA.surcharges.fuel_and_logistics.rate));
}

/**
 * What moving Large standard → Small standard is worth for this unit.
 * Returns null if either tier's weight band is outside the captured card.
 */
export function tierSaving({ weightOz, price, card = 'standard' }) {
  const large = fulfillmentFee({ tier: 'large_standard', weightOz, price, card });
  const small = fulfillmentFee({ tier: 'small_standard', weightOz, price, card });
  if (!large || !small) return null;

  const base = round2(large.fee - small.fee);
  return {
    card,
    price_band: priceBand(price),
    large: { ...large, with_surcharge: withSurcharge(large.fee) },
    small: { ...small, with_surcharge: withSurcharge(small.fee) },
    saving_base: base,
    saving_with_surcharge: round2(withSurcharge(large.fee) - withSurcharge(small.fee)),
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());

if (isMain) {
  const args = process.argv.slice(2);
  const card = args.includes('--apparel') ? 'apparel' : 'standard';
  const [oz, price] = args.filter(a => !a.startsWith('--')).map(Number);

  if (Number.isNaN(oz) || Number.isNaN(price)) {
    console.error('usage: node lib/tier-saving.mjs <weight_oz> <price> [--apparel]');
    process.exit(1);
  }

  const r = tierSaving({ weightOz: oz, price, card });
  console.log('');
  if (!r) {
    console.log(`  ${oz}oz is outside the captured weight bands for one of the tiers.`);
  } else {
    console.log(`  ${oz}oz @ $${price.toFixed(2)}  ·  ${r.card} rate card  ·  ${r.price_band} band`);
    console.log('');
    console.log(`  Large standard  ${r.large.band.padEnd(13)} $${r.large.fee.toFixed(2)}   with surcharge $${r.large.with_surcharge.toFixed(2)}`);
    console.log(`  Small standard  ${r.small.band.padEnd(13)} $${r.small.fee.toFixed(2)}   with surcharge $${r.small.with_surcharge.toFixed(2)}`);
    console.log('');
    console.log(`  SAVING          $${r.saving_with_surcharge.toFixed(2)}/unit if the carton clears the 0.75in shortest-side limit`);
  }
  console.log('');
  console.log(`  period     non-peak, ${FBA._periods.non_peak_2026.from} to ${FBA._periods.non_peak_2026.to}`);
  console.log(`  provenance ${FBA._source_tier.toUpperCase()} — Seller Central rate card, read ${FBA._retrieved}`);
  console.log('');
}
