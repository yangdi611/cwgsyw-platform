'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const canvasConsumers = [
  'src/features/cmdb-spatial',
  'src/components/cmdb/CiTopologyGraph.tsx',
  'src/components/workflow/BpmnViewer.tsx',
  'src/components/workflow/BpmnEditor.tsx',
]
const skipDirs = new Set(['node_modules', '.next'])
const rawHex = /#[0-9a-fA-F]{3,8}\b/
const brokenTokenAttr = /\b(?:fill|stroke)=CANVAS_/

function walk(target, files = []) {
  const full = path.join(frontendRoot, target)
  const stat = fs.statSync(full)
  if (stat.isFile()) {
    files.push(full)
    return files
  }
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const next = path.join(full, entry.name)
    if (entry.isDirectory()) walk(path.relative(frontendRoot, next), files)
    else if (/\.(tsx?|css|js|cjs|mjs)$/.test(entry.name)) files.push(next)
  }
  return files
}

test('canvas consumers use canvas-tokens instead of raw hex or broken token attrs', () => {
  const hexHits = []
  const brokenHits = []
  for (const target of canvasConsumers) {
    for (const file of walk(target)) {
      const rel = path.relative(frontendRoot, file)
      const source = fs.readFileSync(file, 'utf8')
      if (rawHex.test(source)) hexHits.push(rel)
      if (brokenTokenAttr.test(source)) brokenHits.push(rel)
    }
  }
  assert.deepEqual(hexHits, [])
  assert.deepEqual(brokenHits, [])
})
