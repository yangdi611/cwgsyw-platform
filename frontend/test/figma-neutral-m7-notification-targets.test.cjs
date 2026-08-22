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
const resolvePath = path.join(frontendRoot, 'src/app/(dashboard)/notifications/targets/resolve/[notificationId]/page.tsx')
const refPath = path.join(frontendRoot, 'src/app/(dashboard)/notifications/targets/[refType]/[refId]/page.tsx')

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

function loadCompiled(filePath, params) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') {
      return { useParams: () => params, useRouter: () => ({ replace() {} }) }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({ data: { available: false, href: null }, isLoading: false }),
      }
    }
    if (request === '@/lib/api') return { default: { get: async () => ({ data: { data: {} } }) } }
    if (request.startsWith('@/')) {
      const resolved = path.join(frontendRoot, 'src', request.slice(2))
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit) return loadCompiled(hit, params)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit, params)
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

test('notification target pages leave old visual entries and keep resolve APIs', () => {
  const resolve = fs.readFileSync(resolvePath, 'utf8')
  const ref = fs.readFileSync(refPath, 'utf8')
  const unlink = fs.readFileSync(path.join(frontendRoot, 'public/figma-icons/notification-unlink.svg'), 'utf8')
  assert.match(resolve, /figma-neutral\/index\.css/)
  assert.match(resolve, /DetailDrawerPage/)
  assert.match(resolve, /showBreadcrumb=\{false\}/)
  assert.match(resolve, /actions=\{/)
  assert.match(ref, /actions=\{/)
  const empty = fs.readFileSync(path.join(frontendRoot, 'src/components/notification/NotificationEmpty.tsx'), 'utf8')
  assert.match(empty, /notification-unlink\.svg/)
  assert.match(empty, /6:30491/)
  assert.match(resolve, /queryKey: \['notification-target', id\]/)
  assert.match(resolve, /\/notifications\/\$\{id\}\/target/)
  assert.match(ref, /DetailDrawerPage/)
  assert.match(ref, /queryKey: \['notification-target', refType, id\]/)
  assert.match(ref, /\/change-docs\/\$\{id\}/)
  assert.match(ref, /\/cmdb\/instances\/\$\{id\}/)
  assert.match(ref, /\/wiki\/pages\/\$\{id\}/)
  assert.doesNotMatch(resolve, /@\/components\/design-system/)
  assert.doesNotMatch(ref, /@\/components\/design-system/)
  assert.match(unlink, /<svg/)
})

test('notification target resolver renders Neutral unavailable empty state', () => {
  const page = loadCompiled(resolvePath, { notificationId: '7' })
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /目标解析/)
  assert.match(html, /通知目标不可用/)
  assert.match(html, /返回通知中心/)
  assert.match(html, /notification-unlink\.svg/)
})

test('notification target pages keep return actions on the right', () => {
  const resolve = fs.readFileSync(resolvePath, 'utf8')
  const ref = fs.readFileSync(refPath, 'utf8')
  assert.match(resolve, /cwgsyw-notifications__header-actions/)
  assert.match(ref, /cwgsyw-notifications__header-actions/)
})

