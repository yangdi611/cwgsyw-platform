'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(frontendRoot, 'src')
const skipDirs = new Set(['node_modules', '.next'])
const leftover = /bg-popover|text-popover-foreground|hover:"|border {2,}|divide-y (?!divide-\[)/

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full)
  }
  return files
}

test('frontend chrome has no leftover popover tokens or stripped Tailwind utilities', () => {
  const hits = []
  for (const file of walk(srcRoot)) {
    if (file.includes(`${path.sep}design-system${path.sep}figma-neutral${path.sep}`)) continue
    const source = fs.readFileSync(file, 'utf8')
    if (leftover.test(source)) hits.push(path.relative(frontendRoot, file))
  }
  assert.deepEqual(hits, [])
})

test('analytics and topology leftover chrome use Neutral surface tokens', () => {
  const topology = fs.readFileSync(path.join(frontendRoot, 'src/components/cmdb/CiTopologyGraph.tsx'), 'utf8')
  assert.match(topology, /bg-\[var\(--cwgsyw-bg-surface\)\]/)
  assert.match(topology, /text-\[var\(--cwgsyw-text-primary\)\]/)
  assert.doesNotMatch(topology, /bg-popover/)

  const dashboard = fs.readFileSync(path.join(frontendRoot, 'src/components/task-analytics/TaskAnalyticsDashboard.tsx'), 'utf8')
  assert.match(dashboard, /border-\[var\(--cwgsyw-border-default\)\]/)
  assert.match(dashboard, /hover:bg-\[var\(--cwgsyw-bg-surface-hover\)\]/)

  const metrics = fs.readFileSync(path.join(frontendRoot, 'src/components/task-analytics/TaskMetricsManager.tsx'), 'utf8')
  assert.match(metrics, /divide-\[var\(--cwgsyw-border-subtle\)\]/)
})
