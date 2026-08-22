'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const globals = fs.readFileSync(path.join(frontendRoot, 'src/app/globals.css'), 'utf8')
const page = fs.readFileSync(
  path.join(frontendRoot, 'src/app/(dashboard)/wiki/[spaceId]/[pageId]/edit/page.tsx'),
  'utf8',
)
const css = fs.readFileSync(path.join(frontendRoot, 'src/components/wiki/WikiEditor.css'), 'utf8')

test('wiki editor theme lives next to the editor and uses Neutral tokens', () => {
  assert.doesNotMatch(globals, /\.wiki-editor/)
  assert.match(page, /WikiEditor\.css/)
  assert.match(css, /--cwgsyw-bg-surface/)
  assert.match(css, /--cwgsyw-control-height-sm/)
  assert.doesNotMatch(css, /oklch\(/)
  assert.doesNotMatch(css, /#2563eb|#1d4ed8/)
})

test('wiki editor header actions stay on the right of the shell header', () => {
  const patterns = fs.readFileSync(
    path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'),
    'utf8',
  )
  assert.match(page, /cwgsyw-wiki__header-actions/)
  assert.match(page, />\s*返回\s*<\/Button>/)
  assert.match(page, />\s*保存\s*<\/Button>/)
  assert.match(
    patterns,
    /\.cwgsyw-wiki-edit__head \.cwgsyw-wiki__header-actions \{[\s\S]{0,80}margin-left: auto/,
  )
})

test('wiki editor toolbar uses Figma outline icons instead of bold heading text', () => {
  assert.match(page, /WIKI_EDITOR_TOOLBAR_ICONS/)
  assert.match(page, /WikiEditorToolbarIcon/)
  assert.match(page, /cwgsyw-wiki-editor__toolbar-icon/)
  assert.match(page, /heading1: 'heading-1'/)
  assert.match(page, /fullscreen: 'maximize-2'/)
  assert.doesNotMatch(page, /lucide-react/)
  assert.doesNotMatch(page, /fontSize:\s*18/)
  assert.match(css, /--cwgsyw-control-icon-sm/)
  assert.match(css, /cwgsyw-wiki-editor__toolbar-icon--heading-1/)
  assert.match(css, /url\('\/figma-icons\/wiki-editor-heading-1\.svg'\)/)
  assert.doesNotMatch(css, /--cwgsyw-control-icon-md/)
  const iconDir = path.join(frontendRoot, 'public/figma-icons')
  for (const name of [
    'bold',
    'heading',
    'heading-1',
    'heading-6',
    'help',
    'message-square',
    'maximize-2',
  ]) {
    const file = path.join(iconDir, `wiki-editor-${name}.svg`)
    assert.equal(fs.existsSync(file), true, file)
    const svg = fs.readFileSync(file, 'utf8')
    assert.match(svg, /<path/)
    assert.match(svg, /<\/svg>/)
  }
})

