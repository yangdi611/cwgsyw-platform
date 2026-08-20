'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const breadcrumb = fs.readFileSync(
  path.resolve(__dirname, '../src/components/layout/Breadcrumb.tsx'),
  'utf8',
)
const navGroup = fs.readFileSync(
  path.resolve(__dirname, '../src/components/layout/sidebar/NavGroupItem.tsx'),
  'utf8',
)

test('breadcrumb and nav group use Neutral chevron icons already in the formal set', () => {
  assert.doesNotMatch(breadcrumb, /from 'lucide-react'/)
  assert.match(breadcrumb, /name="chevron-right"/)
  assert.doesNotMatch(navGroup, /from 'lucide-react'/)
  assert.match(navGroup, /name="chevron-down"/)
  assert.doesNotMatch(breadcrumb, /name="bell"|name="panel-left/)
  assert.doesNotMatch(navGroup, /name="bell"|name="panel-left/)
})
