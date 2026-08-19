#!/usr/bin/env node
// Referral dead zones.
//
// Where a category uses `whole_price` tiering, crossing a bracket boundary
// re-rates the ENTIRE price, not just the portion above it. That produces a
// band immediately above each boundary in which raising your price LOWERS your
// net revenue.
//
// Apparel is the clearest case. At $20.00 the seller nets $18.00. At $20.01
// they net $16.61. They do not get back to $18.00 until $21.69 — so every
// price in between is strictly worse than $20.00.
//
// `marginal` categories have no dead zones by construction; only the slice
// above the boundary is re-rated, so net revenue is monotonic. This is the
// practical reason the mode distinction matters.
//
// Usage:
//   node lib/dead-zone.mjs apparel            # list the dead zones
//   node lib/dead-zone.mjs apparel 20.49      # is this price in one?

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { referralFee } from './referral-fee.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = JSON.parse(
  readFileSync(join(HERE, '..', 'corpus', 'amazon-us.json'), 'utf8')
);

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

/** Net revenue after the referral fee. */
export function net(category, price) {
  return round2(price - referralFee(category, price).fee);
}

/**
 * Dead zones for a category.
 *
 * For each `whole_price` boundary B: the seller's best net at or below B is
 * net(B). Immediately above B the higher rate applies to the whole price, so
 * net drops. The zone ends at the price whose net first matches net(B) again.
 *
 * @returns {Array<{ boundary:number, best_net:number, zone_start:number,
 *                   zone_end:number, worst_price:number, worst_loss:number }>}
 */
export function deadZones(category) {
  const tiered = CORPUS.referral_fees.tiered[category];
  if (!tiered || tiered.mode !== 'whole_price') return [];

  const zones = [];

  for (const b of tiered.brackets) {
    const boundary = b.up_to_usd;
    if (boundary == null) continue;               // open-ended top bracket

    const bestNet = net(category, boundary);
    const start = round2(boundary + 0.01);
    if (net(category, start) >= bestNet) continue; // no dip — not a dead zone

    // Walk up in cents until net recovers. Bounded so a malformed corpus
    // cannot spin: the recovery point is analytically ~boundary/(1-rate).
    let end = null;
    const ceiling = boundary * 2 + 5;
    for (let p = start; p <= ceiling; p = round2(p + 0.01)) {
      if (net(category, p) >= bestNet) { end = round2(p - 0.01); break; }
    }
    if (end == null) continue;

    zones.push({
      boundary,
      best_net: bestNet,
      zone_start: start,
      zone_end: end,
      worst_price: start,
      worst_loss: round2(bestNet - net(category, start)),
    });
  }

  return zones;
}

/** Is this price inside a dead zone? Returns the zone plus the fix, or null. */
export function checkPrice(category, price) {
  for (const z of deadZones(category)) {
    if (price >= z.zone_start && price <= z.zone_end) {
      return {
        ...z,
        price,
        current_net: net(category, price),
        loss_per_unit: round2(z.best_net - net(category, price)),
        fix: `drop to $${z.boundary.toFixed(2)}`,
        alternative: `or raise above $${round2(z.zone_end + 0.01).toFixed(2)}`,
      };
    }
  }
  return null;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());

if (isMain) {
  const category = process.argv[2];
  const price = process.argv[3] != null ? Number(process.argv[3]) : null;

  if (!category) {
    console.error('usage: node lib/dead-zone.mjs <category> [price]');
    console.error(`whole_price categories: ${Object.entries(CORPUS.referral_fees.tiered)
      .filter(([k, v]) => !k.startsWith('_') && v.mode === 'whole_price')
      .map(([k]) => k).join(', ')}`);
    process.exit(1);
  }

  const zones = deadZones(category);

  if (!zones.length) {
    const t = CORPUS.referral_fees.tiered[category];
    console.log('');
    console.log(`  ${category} has no dead zones` +
      (t ? ` — mode is "${t.mode}", so net revenue is monotonic.` : ' — flat rate.'));
    console.log('');
    process.exit(0);
  }

  console.log('');
  if (price == null) {
    console.log(`  ${category} — referral dead zones`);
    console.log('');
    for (const z of zones) {
      console.log(`  $${z.zone_start.toFixed(2)} – $${z.zone_end.toFixed(2)}`);
      console.log(`    every price here nets less than pricing at $${z.boundary.toFixed(2)} ($${z.best_net.toFixed(2)})`);
      console.log(`    worst at $${z.worst_price.toFixed(2)}: down $${z.worst_loss.toFixed(2)}/unit`);
      console.log('');
    }
  } else {
    const hit = checkPrice(category, price);
    console.log(`  ${category} @ $${price.toFixed(2)}`);
    if (hit) {
      console.log(`  net        $${hit.current_net.toFixed(2)}`);
      console.log('');
      console.log(`  FINDING    inside a dead zone ($${hit.zone_start.toFixed(2)} – $${hit.zone_end.toFixed(2)})`);
      console.log(`             $${hit.boundary.toFixed(2)} nets $${hit.best_net.toFixed(2)} — $${hit.loss_per_unit.toFixed(2)}/unit more`);
      console.log(`             fix: ${hit.fix}, ${hit.alternative}`);
    } else {
      console.log(`  net        $${net(category, price).toFixed(2)}`);
      console.log('  FINDING    not in a dead zone');
    }
  }
  console.log(`  provenance ${CORPUS.referral_fees.tiered[category]._source_tier.toUpperCase()} — ${CORPUS.referral_fees.tiered[category]._mode_confidence}`);
  console.log('');
}
