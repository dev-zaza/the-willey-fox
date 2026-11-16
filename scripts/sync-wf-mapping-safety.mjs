#!/usr/bin/env node
/**
 * WF-32 — sync helper for WF-mapping daily safety artifacts into SafeTag.
 *
 * Copies curated city knowledge/guides from the sibling WF-mapping repo into
 * the NestJS assets folders used by travel-guide endpoints.
 *
 * Crime layer ingest (US/AU/JP/etc. street feeds) remains scheduled through the
 * Nest safety-engine adapters; this script keeps static guide/knowledge assets
 * and documents the expected ops loop for daily scores.
 *
 * Usage (from safetag/):
 *   node scripts/sync-wf-mapping-safety.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const safetagRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(safetagRoot, '..');
const wfMapping = path.join(repoRoot, 'WF-mapping');

const pairs = [
  {
    from: path.join(wfMapping, 'city_knowledge'),
    to: path.join(safetagRoot, 'apps/backend/src/assets/city-knowledge'),
  },
  {
    from: path.join(wfMapping, 'city_guides'),
    to: path.join(safetagRoot, 'apps/backend/src/assets/city-guides'),
  },
];

function copyJsonTree(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) {
    console.warn(`[skip] missing source ${fromDir}`);
    return 0;
  }
  fs.mkdirSync(toDir, { recursive: true });
  let count = 0;
  for (const name of fs.readdirSync(fromDir)) {
    if (!name.endsWith('.json')) continue;
    fs.copyFileSync(path.join(fromDir, name), path.join(toDir, name));
    count += 1;
  }
  return count;
}

let total = 0;
for (const { from, to } of pairs) {
  const n = copyJsonTree(from, to);
  console.log(`[sync] ${n} files → ${path.relative(safetagRoot, to)}`);
  total += n;
}

const stampPath = path.join(safetagRoot, 'apps/backend/src/assets/wf-mapping-sync.json');
fs.writeFileSync(
  stampPath,
  JSON.stringify(
    {
      syncedAt: new Date().toISOString(),
      filesCopied: total,
      note: 'Run after WF-mapping daily pipeline. Recalculate h3_safety_scores via safety-engine ingest jobs.',
    },
    null,
    2,
  ),
);
console.log(`[sync] wrote ${path.relative(safetagRoot, stampPath)}`);
console.log('[sync] done');
