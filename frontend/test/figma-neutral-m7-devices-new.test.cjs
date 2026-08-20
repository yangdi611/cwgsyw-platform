'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const frontendRoot = path.resolve(__dirname, '..')
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/devices/new/page.tsx')

function compileTs(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ push() {} }) }
    if (request === 'next/link') {
      return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({ data: undefined }),
        useMutation: () => ({ mutate() {}, isPending: false }),
      }
    }
    if (request === '@/components/cmdb/CiInstanceSelect') {
      return { CiInstanceSelect: () => React.createElement('div', { 'data-testid': 'ci-select' }, 'CI 选择器') }
    }
    if (request === '@/lib/api') return { default: { get: async () => ({ data: { data: {} } }), post: async () => ({}) } }
    if (request === '@/lib/api-error') return { getApiErrorMessage: () => 'error' }
    if (request.startsWith('@/')) {
      const resolved = path.join(frontendRoot, 'src', request.slice(2))
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit) return loadCompiled(hit)
    }
    if (request.startsWith('./') && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit)
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

test('new device page leaves old visual entries and keeps the create API', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /FormSettingsPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /href=\"\/cmdb\"/)
  assert.match(page, /queryKey: \['ci-detail-for-device', ciId\]/)
  assert.match(page, /api\.post\('\/devices'/)
  assert.match(page, /ciInstanceId/)
  assert.match(page, /CiInstanceSelect/)
  assert.match(fs.readFileSync(path.join(frontendRoot, 'src/components/cmdb/CiInstanceSelect.tsx'), 'utf8'), /cwgsyw-select/)
  assert.match(fs.readFileSync(path.join(frontendRoot, 'src/components/cmdb/CiInstanceSelect.tsx'), 'utf8'), /cmdb\/instances\/\$\{value\}/)
  assert.match(fs.readFileSync(path.join(frontendRoot, 'src/components/cmdb/CiInstanceSelect.tsx'), 'utf8'), /cwgsyw-ci-select__value/)
  assert.match(fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8'), /\.cwgsyw-devices-panel,[\s\S]{0,280}overflow: visible/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
})

test('new device page renders Neutral form and CMDB picker slot', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /新增设备凭证/)
  assert.match(html, /选择 CMDB 资产/)
  assert.match(html, /CI 选择器/)
  assert.match(html, /创建设备/)
  assert.doesNotMatch(html, /<main/)
})
