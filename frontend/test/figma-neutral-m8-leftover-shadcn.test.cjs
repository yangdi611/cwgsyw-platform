'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(frontendRoot, 'src')
const leftover = /bg-gray-|text-gray-|border-gray-|bg-muted|text-muted-foreground|hover:bg-muted|bg-background|text-foreground|bg-accent|text-accent-foreground|bg-popover|text-popover-foreground|text-amber-|bg-amber-|text-red-500|bg-red-500|text-green-500|bg-green-500/
const skipDirs = new Set(['node_modules', '.next'])

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full)
  }
  return files
}

test('frontend source no longer uses leftover shadcn or gray utility colors', () => {
  const hits = []
  for (const file of walk(srcRoot)) {
    const rel = path.relative(frontendRoot, file)
    const source = fs.readFileSync(file, 'utf8')
    if (leftover.test(source)) hits.push(rel)
  }
  assert.deepEqual(hits, [])
})
