'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/components/wiki/WikiTreeSidebar.tsx'),
  'utf8',
)

test('wiki tree sidebar uses Neutral Button and IconButton instead of native buttons', () => {
  assert.doesNotMatch(source, /<button[\s>]/)
  assert.match(source, /\bButton\b/)
  assert.match(source, /\bIconButton\b/)
  assert.match(source, /aria-label="新建页面"/)
  assert.match(source, /aria-label=\{\`\$\{pageTitle\} 操作\`\}/)
  assert.match(source, /\bDropdownMenu\b/)
  assert.match(source, /label="新建子页面"/)
  assert.match(source, /label="重命名"/)
  assert.match(source, /label="上移"/)
  assert.match(source, /label="下移"/)
  assert.match(source, /label="删除"/)
  assert.doesNotMatch(source, /NeutralTooltip/)
  assert.doesNotMatch(source, /h-7 w-7 px-0/)
  assert.doesNotMatch(source, /w-7 shrink-0/)
  assert.doesNotMatch(source, /paddingLeft: `\$\{4 \+ depth \* 14\}px`/)
  assert.match(source, /cwgsyw-wiki-tree__chevron-btn/)
  assert.match(source, /cwgsyw-wiki-tree__chevron-spacer/)
  assert.match(source, /paddingLeft: depth \* 10/)
  assert.match(source, /cwgsyw-cmdb-admin__figma-action-icon--plus/)
  assert.match(source, /cwgsyw-wiki-tree__more-icon/)
  assert.doesNotMatch(source, /from 'lucide-react'/)
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/design-system/figma-neutral/components/patterns.css'),
    'utf8',
  )
  assert.match(css, /\.cwgsyw-wiki-tree__title \{[\s\S]{0,160}flex: 1 1 0/)
  assert.match(css, /\.cwgsyw-wiki-tree__chevron-spacer \{[\s\S]{0,80}width: 16px/)
  assert.match(css, /\.cwgsyw-wiki-tree__list \{[\s\S]{0,120}padding: 0 4px 16px/)
  assert.match(css, /\.cwgsyw-wiki-tree__row-actions \{[\s\S]{0,120}flex: 0 0 auto/)
  assert.match(css, /cmdb-admin-more-horizontal\.svg/)
  assert.match(css, /\.cwgsyw-wiki-tree__row\.is-active,[\s\S]{0,80}background: var\(--cwgsyw-bg-surface-hover\)/)
  assert.match(css, /\.cwgsyw-wiki-tree__title,[\s\S]{0,220}background: transparent/)
  assert.match(css, /\.cwgsyw-wiki-tree__row-actions \.cwgsyw-icon-btn,[\s\S]{0,360}background: transparent/)
})


test('wiki space layout collapse toggle lives in the content header with a left arrow', () => {
  const layout = fs.readFileSync(
    path.resolve(__dirname, '../src/app/(dashboard)/wiki/[spaceId]/layout.tsx'),
    'utf8',
  )
  const page = fs.readFileSync(
    path.resolve(__dirname, '../src/app/(dashboard)/wiki/[spaceId]/[pageId]/page.tsx'),
    'utf8',
  )
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/design-system/figma-neutral/components/patterns.css'),
    'utf8',
  )
  const chrome = fs.readFileSync(
    path.resolve(__dirname, '../src/components/wiki/WikiShellChrome.tsx'),
    'utf8',
  )
  assert.match(layout, /className="cwgsyw-wiki-shell__header"/)
  assert.match(layout, /WikiShellToggle/)
  assert.match(layout, /isWikiDocumentRoute/)
  assert.match(chrome, /className="cwgsyw-wiki-shell__toggle"/)
  assert.match(chrome, /icon=\{ctx\.collapsed \? 'chevron-next' : 'chevron-previous'\}/)
  assert.doesNotMatch(layout, /cwgsyw-files-tree__chevron/)
  assert.match(page, /WikiShellToggle/)
  assert.match(page, /cwgsyw-wiki-page__body-head/)
  const spaceHome = fs.readFileSync(
    path.resolve(__dirname, '../src/app/(dashboard)/wiki/[spaceId]/page.tsx'),
    'utf8',
  )
  assert.match(spaceHome, /WikiShellToggle/)
  assert.match(spaceHome, /cwgsyw-wiki-space-home__head-start/)
  assert.match(layout, /isWikiDocumentRoute \|\| isSpaceHome/)
  assert.match(css, /\.cwgsyw-wiki-shell \{[\s\S]{0,180}grid-template-columns: 260px minmax\(0, 1fr\)/)
  assert.doesNotMatch(css, /grid-template-columns: 260px 32px minmax\(0, 1fr\)/)
  assert.match(css, /\.cwgsyw-wiki-shell__header \{[\s\S]{0,160}grid-column: 1 \/ -1/)
  assert.match(css, /\.cwgsyw-wiki-shell__nav \{[\s\S]{0,180}grid-row: 2/)
  assert.match(css, /\.cwgsyw-wiki-page__body-head \{[\s\S]{0,80}justify-content: flex-start/)
})
