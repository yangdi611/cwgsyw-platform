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
const patterns = fs.readFileSync(
  path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'),
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

test('rack hover card anchors beside the rack and flips at the viewport edge', () => {
  assert.match(rack, /const canFitRight = svgBox\.right \+ gap \+ popoverWidth <= window\.innerWidth - viewportPadding/)
  assert.match(rack, /const side = canFitRight \? 'right' : 'left'/)
  assert.match(rack, /role="tooltip"/)
  assert.match(rack, /data-side=\{hover\.side\}/)
  assert.match(rack, /position: 'fixed'/)
  assert.match(rack, /createPortal\([\s\S]*document\.body/s)
  assert.doesNotMatch(rack, /Math\.min\(hover\.x \+ 16, wrapWidth - 248\)/)
})

test('rack hover card stays interactive while the pointer crosses from device to card', () => {
  assert.match(rack, /hoverCloseTimerRef/)
  assert.match(rack, /setTimeout\(\(\) => \{[\s\S]*setHover\(null\)[\s\S]*\}, 180\)/s)
  assert.match(rack, /onMouseEnter=\{cancelHoverClose\}/)
  assert.match(rack, /onMouseLeave=\{scheduleHoverClose\}/)
  assert.match(rack, /href=\{`\/cmdb\/instances\/by-model\/\$\{hover\.d\.modelId\}\/\$\{hover\.d\.id\}`\}/)
  assert.match(rack, />\s*查看详情\s*<\/Link>/)
  assert.match(patterns, /\.cwgsyw-popover--hover\.cwgsyw-cmdb-rack-view__popover\s*\{[^}]*pointer-events:\s*auto/s)
})

test('rack add-device link uses Neutral button recipe', () => {
  assert.match(rack, /cwgsyw-btn cwgsyw-btn--sm cwgsyw-btn--outline/)
  assert.doesNotMatch(rack, /h-8 px-3/)
})
