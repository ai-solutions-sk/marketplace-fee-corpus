#!/usr/bin/env node
// FBA size-tier classifier and boundary-proximity finder.
//
// This exists to answer one question, for a stranger, before they have replied
// to an email: "how close is this product to a cheaper size tier?"
//
// It deliberately does NOT compute fulfillment fees. The corpus does not yet
// hold per-tier base rates (see corpus/amazon-us.json → fulfillment_fee_changes_2026
// ._warning), and inventing them is exactly the failure mode this project exists
// to counter-position against.
//
// Usage:
//   node lib/size-tier.mjs 12.3 9.1 0.9 14        # L W H (in) + weight (oz)
//   node lib/size-tier.mjs 12.3 9.1 0.9 2.5 --lb  # weight in pounds

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = JSON.parse(
  readFileSync(join(HERE, '..', 'corpus', 'amazon-us.json'), 'utf8')
);

// Tiers we can evaluate with confidence. `bulky` is flagged _incomplete in the
// corpus, so anything that overflows large_standard is reported as "beyond
// large standard" rather than guessed at.
const EVALUABLE = ['small_standard', 'large_standard'];

/** Sort measured sides into Amazon's longest / median / shortest convention. */
export function orderSides(a, b, c) {
  const [shortest, median, longest] = [a, b, c].sort((x, y) => x - y);
  return { longest, median, shortest };
}

function weightLimitOz(tier) {
  if (tier.max_weight_oz != null) return tier.max_weight_oz;
  if (tier.max_weight_lb != null) return tier.max_weight_lb * 16;
  return Infinity;
}

/**
 * Classify a unit and report distance to every cheaper tier it misses.
 *
 * @param {{ longest:number, median:number, shortest:number, weightOz:number }} unit
 * @returns {{ tier:string|null, label:string, misses:Array }}
 */
export function classify({ longest, median, shortest, weightOz }) {
  const tiers = CORPUS.fba_size_tiers.tiers.filter(t => EVALUABLE.includes(t.id));
  const misses = [];

  for (const tier of tiers) {
    const gaps = [];

    const checks = [
      ['longest side',  longest,  tier.max_longest_in,  'in'],
      ['median side',   median,   tier.max_median_in,   'in'],
      ['shortest side', shortest, tier.max_shortest_in, 'in'],
      ['weight',        weightOz, weightLimitOz(tier),  'oz'],
    ];

    for (const [name, actual, limit, unit] of checks) {
      if (limit == null || limit === Infinity) continue;
      if (actual > limit) {
        gaps.push({
          dimension: name,
          actual,
          limit,
          over_by: Number((actual - limit).toFixed(3)),
          unit,
        });
      }
    }

    if (gaps.length === 0) {
      return { tier: tier.id, label: tier.label, misses };
    }
    misses.push({ tier: tier.id, label: tier.label, gaps, note: tier._boundary_note });
  }

  return { tier: null, label: 'Beyond large standard', misses };
}

/**
 * The outreach finding. Returns a near-miss only when a single dimension is
 * blocking a cheaper tier — one actionable change, not a redesign.
 *
 * `thresholdIn` is how close counts as "worth mentioning to a stranger".
 */
export function nearMiss(result, thresholdIn = 1.0) {
  for (const miss of result.misses) {
    if (miss.gaps.length !== 1) continue;
    const [gap] = miss.gaps;
    if (gap.unit !== 'in' || gap.over_by > thresholdIn) continue;
    return { ...gap, blocks_tier: miss.tier, blocks_label: miss.label, note: miss.note };
  }
  return null;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());

if (isMain) {
  const args = process.argv.slice(2);
  const inLb = args.includes('--lb');
  const nums = args.filter(a => !a.startsWith('--')).map(Number);

  if (nums.length !== 4 || nums.some(Number.isNaN)) {
    console.error('usage: node lib/size-tier.mjs <side1> <side2> <side3> <weight> [--lb]');
    console.error('       sides in inches; weight in ounces unless --lb given');
    process.exit(1);
  }

  const [a, b, c, w] = nums;
  const sides = orderSides(a, b, c);
  const weightOz = inLb ? w * 16 : w;
  const result = classify({ ...sides, weightOz });

  console.log('');
  console.log(`  measured   ${sides.longest}in x ${sides.median}in x ${sides.shortest}in, ${weightOz}oz`);
  console.log(`  tier       ${result.label}`);

  const near = nearMiss(result);
  if (near) {
    console.log('');
    console.log(`  FINDING    ${near.over_by}${near.unit} over the ${near.blocks_label} limit`);
    console.log(`             (${near.dimension} is ${near.actual}${near.unit}, limit is ${near.limit}${near.unit})`);
    if (near.note) console.log(`             ${near.note}`);
  } else if (result.tier === 'small_standard') {
    console.log('  FINDING    already in the cheapest standard tier');
  } else {
    console.log('  FINDING    no single-dimension near miss');
  }

  console.log('');
  console.log(`  corpus     v${CORPUS.corpus_version}, generated ${CORPUS.generated}`);
  console.log(`  provenance ${CORPUS.fba_size_tiers._source_tier.toUpperCase()} — verify before client use`);
  console.log('');
}
