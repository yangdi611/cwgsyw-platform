'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/app/(dashboard)/files/components/FolderTreeNode.tsx',
  'src/app/(dashboard)/files/page.tsx',
]

test('files folder tree uses Neutral Button and IconButton instead of native buttons', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /<button[\s>]/, rel)
  }
  const tree = fs.readFileSync(
    path.resolve(__dirname, '../src/app/(dashboard)/files/components/FolderTreeNode.tsx'),
    'utf8',
  )
  assert.match(tree, /IconButton/)
  assert.match(tree, /aria-label=\{expanded \? '折叠文件夹' : '展开文件夹'\}/)
})
