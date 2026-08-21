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

test('files folder tree stays transparent unless the current folder is highlighted', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/design-system/figma-neutral/components/patterns.css'),
    'utf8',
  )
  assert.match(
    css,
    /\.cwgsyw-files \.cwgsyw-tree-item \{[\s\S]{0,220}background: transparent/,
  )
  assert.match(
    css,
    /\.cwgsyw-files \.cwgsyw-tree-item\[data-selected="true"\][\s\S]{0,80}background: var\(--cwgsyw-bg-surface-hover\)/,
  )
  assert.match(
    css,
    /\.cwgsyw-files \.cwgsyw-files-tree__name:hover:not\(:disabled\):not\(\[aria-busy="true"\]\),/,
  )
  assert.match(
    css,
    /\.cwgsyw-files \.cwgsyw-files-tree__root:hover:not\(:disabled\):not\(\[aria-busy="true"\]\),/,
  )
})

