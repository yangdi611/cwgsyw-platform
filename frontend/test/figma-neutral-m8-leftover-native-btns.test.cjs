'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(frontendRoot, 'src')
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

const reminted = [
  {
    rel: 'src/components/task-runtime/TaskList.tsx',
    must: ['<Button type="button" variant="secondary"', '重试'],
  },
  {
    rel: 'src/components/work/WorkItemList.tsx',
    must: ['<Button type="button" variant="secondary"', '重试'],
  },
  {
    rel: 'src/components/cmdb/BatchEditDialog.tsx',
    must: ['<Button type="button" variant="secondary"', '取消</Button>'],
  },
  {
    rel: 'src/components/cmdb/EndpointLinksCard.tsx',
    must: ['variant="destructive"', 'aria-label="解除连接"', '删除'],
  },
  {
    rel: 'src/components/cmdb/CiLinkSelector.tsx',
    must: ['<Button type="button" size="sm" variant="ghost"', 'handleRemove', '移除'],
  },
  {
    rel: 'src/components/cmdb/RackAssignmentCard.tsx',
    must: ['variant="destructive"', 'aria-label="移出机柜"', '删除'],
  },
  {
    rel: 'src/app/(dashboard)/files/components/FolderTreeNode.tsx',
    must: ['<IconButton', '折叠文件夹', '<Button type="button" variant="ghost"'],
  },
]

test('action leftovers use Neutral Button instead of native cwgsyw-btn', () => {
  for (const item of reminted) {
    const source = fs.readFileSync(path.join(frontendRoot, item.rel), 'utf8')
    assert.doesNotMatch(source, /<button[^>]*cwgsyw-btn/, item.rel)
    for (const snippet of item.must) {
      assert.ok(source.includes(snippet), `${item.rel} missing ${snippet}`)
    }
  }
})

test('frontend chrome has no leftover native cwgsyw-btn action class', () => {
  const hits = []
  for (const file of walk(srcRoot)) {
    if (file.includes(`${path.sep}design-system${path.sep}figma-neutral${path.sep}`)) continue
    const source = fs.readFileSync(file, 'utf8')
    if (/<button[\s\S]{0,160}?cwgsyw-btn/.test(source)) {
      hits.push(path.relative(frontendRoot, file))
    }
  }
  assert.deepEqual(hits, [])
})
