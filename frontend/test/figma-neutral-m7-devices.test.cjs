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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/devices/page.tsx')

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
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({
          data: [
            {
              id: 9,
              name: 'core-sw',
              ip: '10.0.0.1',
              deviceType: 'network',
              category: '交换机',
              groupName: '网络组',
              description: '核心交换机',
              modelGroupCode: 'net',
              modelGroupName: '网络模型',
            },
          ],
          isLoading: false,
          isError: false,
          refetch() {},
        }),
      }
    }
    if (request === '@/components/shared/PermissionGuard') {
      return { PermissionGuard: ({ children }) => React.createElement(React.Fragment, null, children) }
    }
    if (request === '@/lib/api') {
      return { default: { get: async () => ({ data: { data: { records: [] } } }) } }
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

test('devices page leaves old visual entries and keeps the devices API', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /cmdb-resource-key\.svg/)
  assert.match(page, /CmdbInstancePreview/)
  assert.match(page, /cwgsyw-cmdb-preview-drawer/)
  assert.match(page, /size=\"sm\"/)
  assert.match(page, /6:27336/)
  assert.ok(fs.existsSync(path.join(frontendRoot, 'public/figma-icons/cmdb-resource-key.svg')))
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['devices'\]/)
  assert.match(page, /\/devices\/new/)
  assert.match(page, /\/devices\/\$\{selected\.id\}/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared'/)
})

test('devices page renders Neutral table, filters and drawer shell', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /设备密码库/)
  assert.match(html, /core-sw/)
  assert.match(html, /10\.0\.0\.1/)
  assert.match(html, /网络模型/)
  assert.doesNotMatch(html, /<main/)
})
