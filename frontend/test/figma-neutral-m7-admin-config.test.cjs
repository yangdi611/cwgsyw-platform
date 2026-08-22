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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/admin/config/page.tsx')

function compileTs(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') {
      return { get: async () => ({ data: { data: {} } }), put: async () => ({ data: {} }) }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: () => ({ data: { 'smtp.enabled': 'true', 'smtp.host': 'smtp.example.com' }, isLoading: false, isError: false }),
      }
    }
    if (request.startsWith('@base-ui/react/')) {
      const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
      const node = ({ children, className, ...props }) => React.createElement('div', { className, ...props }, children)
      return {
        Dialog: { Root: passthrough, Portal: passthrough, Backdrop: node, Popup: node, Title: node, Description: node, Close: node },
        Menu: { Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
        Popover: { Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
        Tooltip: { Provider: passthrough, Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
      }
    }
    if (request.startsWith('@/')) {
      const resolved = path.join(frontendRoot, 'src', request.slice(2))
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit) return loadCompiled(hit)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit)
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try { mod._compile(compiled, filePath) } finally { Module._load = originalLoad }
  return mod.exports
}

test('admin config leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['admin-config'\]/)
  assert.match(page, /\/admin\/config\/smtp/)
  assert.match(page, /\/admin\/config\/watermark/)
  assert.match(page, /\/admin\/config\/prometheus/)
  assert.match(page, /watermark-preview/)
  assert.match(page, /hasPermission\('notification', 'manage'\)/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /bg-v2-/)
})

test('admin config renders Neutral settings and SMTP tab', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /系统配置/)
  assert.match(html, /邮箱配置/)
  assert.match(html, /邮件服务/)
  assert.match(html, /保存 SMTP 配置/)
  assert.doesNotMatch(html, /<main/)
})

test('admin config page header follows Neutral baseline', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /showEyebrow=\{false\}/)
  assert.match(page, /style="cmdb"/)
  assert.match(page, /cwgsyw-admin-config/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.match(css, /\.cwgsyw-admin-config \.cwgsyw-tabs \{[\s\S]{0,160}align-self: flex-start[\s\S]{0,80}justify-content: flex-start[\s\S]{0,80}margin-left: 0/)
  assert.match(css, /\.cwgsyw-admin-config \.cwgsyw-page__grid > section > div \{[\s\S]{0,160}gap: var\(--cwgsyw-space-3\)/)
})

test('admin config save buttons stay compact and fields are not full-bleed', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(page, /size="sm"/)
  assert.match(page, /保存 SMTP 配置/)
  assert.match(page, /保存 Prometheus 配置/)
  assert.match(page, /保存水印配置/)
  assert.match(css, /\.cwgsyw-admin-config \.cwgsyw-page__grid > section \{[\s\S]{0,160}max-width: 42rem/)
  assert.match(css, /\.cwgsyw-admin-config \.cwgsyw-card \{[\s\S]{0,80}max-width: 42rem/)
  assert.match(css, /\.cwgsyw-admin-config \.cwgsyw-form > \.cwgsyw-btn \{[\s\S]{0,80}width: auto/)
})
