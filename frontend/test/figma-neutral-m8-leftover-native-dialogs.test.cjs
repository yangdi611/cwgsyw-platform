'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/components/wiki/WikiCommentsDrawer.tsx',
  'src/components/wiki/WikiVersionsPanel.tsx',
  'src/app/(dashboard)/admin/backup/page.tsx',
  'src/features/cmdb-spatial/editor/SpatialEditor.tsx',
]

test('wiki comments versions and backup leave native confirm and alert', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /\bconfirm\(/, rel)
    assert.doesNotMatch(source, /\balert\(/, rel)
    assert.match(source, /NeutralAlertDialog|toast\.error/, rel)
  }
})
