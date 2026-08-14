'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(frontendRoot, 'src')
const leftoverAccent = /#2563eb|#3b82f6|#60a5fa|#1d4ed8|#a855f7|#8b5cf6|#0f766e|#0d9488|#0891b2|#06b6d4|#22c55e|#93c5fd/i
const skipDirs = new Set(['node_modules', '.next'])

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(tsx?|css|js|cjs|mjs)$/.test(entry.name)) files.push(full)
  }
  return files
}

test('frontend source has no leftover current-system accent hexes', () => {
  const hits = []
  for (const file of walk(srcRoot)) {
    if (file.includes(`${path.sep}design-system${path.sep}figma-neutral${path.sep}generated${path.sep}`)) continue
    if (file.includes(`${path.sep}design-system${path.sep}figma-neutral${path.sep}source${path.sep}`)) continue
    const source = fs.readFileSync(file, 'utf8')
    if (leftoverAccent.test(source)) hits.push(path.relative(frontendRoot, file))
  }
  assert.deepEqual(hits, [])
})
