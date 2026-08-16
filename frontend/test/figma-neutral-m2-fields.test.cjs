'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const root = path.resolve(__dirname, '../src/design-system/figma-neutral/components')
const selectSource = fs.readFileSync(path.join(root, 'Select.tsx'), 'utf8')
const fieldsCss = fs.readFileSync(path.join(root, 'fields.css'), 'utf8')

function loadTsx(rel) {
  const filePath = path.join(root, rel)
  const source = fs.readFileSync(filePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  }).outputText
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.startsWith('./') && parent && parent.filename && parent.filename.startsWith(root)) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`].find((candidate) => fs.existsSync(candidate))
      if (hit) return loadTsx(path.relative(root, hit))
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try {
    mod._compile(compiled, filePath)
  } finally {
    Module._load = originalLoad
  }
  return mod.exports
}

const { Field } = loadTsx('Field.tsx')
const { Input } = loadTsx('Input.tsx')
const { Textarea } = loadTsx('Textarea.tsx')
const { Select, Combobox } = loadTsx('Select.tsx')
const { Checkbox, Radio, Switch } = loadTsx('Checkbox.tsx')
const { SearchInput } = loadTsx('SearchInput.tsx')
const { DateInput } = loadTsx('DateInput.tsx')

test('Field wires label, helper, required and error text', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Field,
      { label: '设备名称', required: true, helperText: '用于展示', errorText: '请输入有效内容', state: 'error' },
      React.createElement(Input, { placeholder: '请输入内容' }),
    ),
  )
  assert.match(html, /for="cwgsyw-field-/)
  assert.match(html, /\*/)
  assert.match(html, /用于展示/)
  assert.match(html, /role="alert"/)
  assert.match(html, /请输入有效内容/)
  assert.match(html, /aria-invalid/)
  assert.match(html, /cwgsyw-control--error/)
})

test('Input loading disables the native control', () => {
  const html = renderToStaticMarkup(React.createElement(Input, { loading: true, placeholder: '请输入内容' }))
  assert.match(html, /disabled=""/)
  assert.match(html, /role="status"/)
})

test('Search and Date inputs use official icon names', () => {
  const search = renderToStaticMarkup(React.createElement(SearchInput, { placeholder: '搜索' }))
  const date = renderToStaticMarkup(React.createElement(DateInput))
  assert.match(search, /data-icon="search"/)
  assert.match(date, /data-icon="calendar"/)
})

test('Select and Combobox expose listbox semantics', () => {
  const options = [{ value: 'a', label: '核心交换机' }]
  const select = renderToStaticMarkup(
    React.createElement(Select, { options, defaultOpen: true, overlay: true, className: 'wide-select', 'aria-label': '选择设备', placeholder: '请选择' }),
  )
  const combo = renderToStaticMarkup(React.createElement(Combobox, { options, placeholder: '搜索并选择' }))
  assert.match(select, /aria-haspopup="listbox"/)
  assert.match(select, /role="listbox"/)
  assert.match(select, /cwgsyw-listbox--overlay/)
  assert.match(select, /wide-select/)
  assert.match(select, /aria-label="选择设备"/)
  assert.match(combo, /role="combobox"/)
})

test('Select closes on outside pointer and list items do not overflow their overlay', () => {
  assert.match(selectSource, /document\.addEventListener\('pointerdown', closeOnOutsidePointer\)/)
  assert.match(selectSource, /rootRef\.current\?\.contains\(event\.target as Node\)/)
  assert.match(fieldsCss, /\.cwgsyw-listbox button \{[\s\S]*box-sizing: border-box;/)
  assert.match(fieldsCss, /overflow-wrap: anywhere;/)
})

test('Checkbox Radio Switch keep selection semantics', () => {
  const checkbox = renderToStaticMarkup(React.createElement(Checkbox, { label: '同意', defaultChecked: true }))
  const radio = renderToStaticMarkup(React.createElement(Radio, { label: '选项', name: 'g' }))
  const sw = renderToStaticMarkup(React.createElement(Switch, { label: '启用', defaultChecked: true }))
  assert.match(checkbox, /type="checkbox"/)
  assert.match(radio, /type="radio"/)
  assert.match(sw, /role="switch"/)
})

test('Textarea stays a native multiline control', () => {
  const html = renderToStaticMarkup(React.createElement(Textarea, { placeholder: '请输入内容' }))
  assert.match(html, /<textarea/)
  assert.match(html, /cwgsyw-textarea/)
})
