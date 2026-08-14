'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const topology = fs.readFileSync(path.join(frontendRoot, 'src/components/cmdb/CiTopologyGraph.tsx'), 'utf8')
const rack = fs.readFileSync(path.join(frontendRoot, 'src/components/cmdb/RackElevationView.tsx'), 'utf8')
const css = fs.readFileSync(
  path.join(frontendRoot, 'src/design-system/figma-neutral/components/overlay.css'),
  'utf8',
)

test('CMDB hover cards use Neutral popover hover modifier instead of handwritten surfaces', () => {
  for (const [rel, source] of [['CiTopologyGraph', topology], ['RackElevationView', rack]]) {
    assert.match(source, /cwgsyw-popover cwgsyw-popover--hover/, rel)
    assert.doesNotMatch(source, /shadow-xl/, rel)
    assert.doesNotMatch(source, /backdrop-blur/, rel)
    assert.doesNotMatch(source, /shadow-\[var\(--cwgsyw-elevation-lg\)\]/, rel)
    assert.doesNotMatch(source, /bg-popover/, rel)
  }
  assert.match(css, /\.cwgsyw-popover--hover/)
  assert.match(css, /pointer-events: none/)
  assert.doesNotMatch(css, /cwgsyw-tooltip--hover/)
})

test('rack add-device link uses Neutral button recipe', () => {
  assert.match(rack, /cwgsyw-btn cwgsyw-btn--sm cwgsyw-btn--outline/)
  assert.doesNotMatch(rack, /h-8 px-3/)
})
