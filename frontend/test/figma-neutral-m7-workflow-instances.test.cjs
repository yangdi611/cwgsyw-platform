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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/workflow/instances/page.tsx')

function compile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compile(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {}, back() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') {
      return {
        get: async () => ({ data: { data: { records: [{ id: '1', name: '变更审批流', key: 'changeDocApproval', version: 2, category: '审批', activeVersion: 2 }], total: 1 } } }),
        put: async () => ({ data: {} }),
        post: async () => ({ data: {} }),
        delete: async () => ({ data: {} }),
      }
    }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback }
    if (request === '@/types/api') {
      return { extractPaginated: (r) => r.data.data }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: ({ queryKey } = {}) => {
          const key = String(queryKey || '')
          if (key.includes('process-stats')) {
            return { data: [{ processDefinitionKey: 'changeDocApproval', name: '变更审批流', version: 2, totalStarted: 10, runningCount: 1, finishedCount: 9, successRate: 90, avgDurationSeconds: 120 }], isLoading: false }
          }
          if (key === 'instances-running' || key === 'instances-finished' || key.includes('instances-running') || key.includes('instances-finished')) {
            return {
              data: {
                records: [
                  { id: 'i1', processDefinitionName: '变更审批流', processDefinitionKey: 'changeDocApproval', businessKey: 'DOC-1', startTime: '2026-08-14T00:00:00Z', endTime: null, ended: false, suspended: false },
                  { id: 'i2', processDefinitionName: '', processDefinitionKey: 'wikiPublishApproval', businessKey: 'WIKI-PUBLISH-APPROVAL-20260820-000001', startTime: '2026-08-14T00:00:00Z', endTime: null, ended: false, suspended: false },
                  { id: 'i3', processDefinitionName: '', processDefinitionKey: '', businessKey: '', startTime: '2026-08-14T00:00:00Z', endTime: null, ended: false, suspended: false },
                ],
                total: 3,
              },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (key.includes('workflow-bindings')) {
            return { data: [{ id: 1, businessType: 'change_doc', processDefinitionId: 'd1', processDefinitionKey: 'changeDocApproval', processDefinitionVersion: 2, templateInstanceId: null, enabled: true, updatedAt: '2026-08-14T00:00:00Z' }], isLoading: false, refetch() {} }
          }
          if (key.includes('workflow-definitions-all')) {
            return { data: [{ id: 'd1', name: '变更审批流', key: 'changeDocApproval', version: 2 }] }
          }
          if (key.includes('workflow-template-instances')) {
            return { data: [], isLoading: false, refetch() {} }
          }
          if (key.includes('workflow-templates')) {
            return { data: [{ code: 'two_level', name: '两级审批', description: '两级', version: 1, supportedBusinessTypes: ['change_doc'], configSchema: [], enabled: true }], isLoading: false }
          }
          return { data: { records: [], total: 0 }, isLoading: false, isError: false, refetch() {} }
        },
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

test('workflow instances leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  const icon = fs.readFileSync(path.join(frontendRoot, 'public/figma-icons/workflow-git-branch.svg'), 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /cwgsyw-workflow/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.match(page, /\/workflow\/instances\/running/)
  assert.match(page, /\/workflow\/instances\/finished/)
  assert.match(page, /workflow-git-branch\.svg/)
  assert.match(page, /data-figma-node="6:26741"/)
  assert.match(page, /showIcon=\{false\}/)
  assert.match(page, /cwgsyw-workflow-instances__table--\$\{tab\}/)
  assert.match(page, /density="compact"/)
  assert.match(page, /cwgsyw-workflow-instances__actions/)
  assert.match(page, /processDefinitionName \|\| inst\.processDefinitionKey \|\| '未命名流程'/)
  assert.match(page, /cwgsyw-workflow-instances__business-key/)
  assert.match(page, /title=\{businessKey\}/)
  assert.doesNotMatch(page, /key: 'actions', label: '操作', align: 'right'/)
  assert.match(css, /\.cwgsyw-workflow-instances__toolbar \{[\s\S]*justify-content: flex-end;/)
  assert.match(css, /\.cwgsyw-workflow-instances__table \.cwgsyw-table \{[\s\S]*table-layout: fixed;/)
  assert.match(css, /\.cwgsyw-workflow-instances__table \.cwgsyw-table-wrap \{[\s\S]*overflow: hidden;/)
  assert.match(css, /\.cwgsyw-workflow-instances__actions \{[\s\S]*flex-wrap: nowrap;/)
  assert.match(icon, /viewBox="0 0 20 20"/)
  assert.match(icon, /id="Union"/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
})

test('workflow instances renders Neutral shell', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /流程实例/)
  assert.match(html, /变更审批流/)
  assert.match(html, /wikiPublishApproval/)
  assert.match(html, /未命名流程/)
  assert.match(html, /title="WIKI-PUBLISH-APPROVAL-20260820-000001"/)
})

test('workflow breadcrumb root stays clickable', () => {
  const config = fs.readFileSync(path.join(frontendRoot, 'src/lib/breadcrumb-config.ts'), 'utf8')
  assert.match(config, /workflow: \{ label: '流程中心', href: '\/workflow\/instances'/)
  assert.match(config, /reports: \{ label: '报表分析', href: '\/tasks\/analytics'/)
  assert.match(config, /system: \{ label: '系统管理', href: '\/admin\/config'/)
})

