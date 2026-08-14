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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/instances/by-model/[modelCode]/[id]/page.tsx')
const tabFiles = [
  path.join(frontendRoot, 'src/components/cmdb/InstanceBasicInfoTab.tsx'),
  path.join(frontendRoot, 'src/components/cmdb/InstanceBasicInfoTab/FieldDisplay.tsx'),
  path.join(frontendRoot, 'src/components/cmdb/InstanceBasicInfoTab/FieldEditor.tsx'),
  path.join(frontendRoot, 'src/components/cmdb/InstanceBasicInfoTab/StatusBadges.tsx'),
  path.join(frontendRoot, 'src/components/cmdb/InstanceBasicInfoTab/TableField.tsx'),
  path.join(frontendRoot, 'src/components/cmdb/InstanceChangeHistoryTab.tsx'),
  path.join(frontendRoot, 'src/components/cmdb/InstanceAlertsTab.tsx'),
  path.join(frontendRoot, 'src/components/cmdb/InstanceResourcesTab.tsx'),
]

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
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ replace() {}, push() {}, back() {} }),
        useParams: () => ({ modelCode: 'server', id: '11' }),
      }
    }
    if (request === 'next/link') {
      return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/lib/api') {
      return { get: async () => ({ data: { data: {} } }), put: async () => ({ data: {} }) }
    }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback, isAxiosError: () => false }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey } = {}) => {
          if (queryKey?.[0] === 'cmdb-instance') {
            return {
              data: {
                id: 11,
                modelId: 'server',
                name: 'web-01',
                displayName: 'web-01',
                fieldsData: {},
                fieldConfig: [],
                attributes: [],
                createdAt: '2026-08-14T00:00:00Z',
                updatedAt: '2026-08-14T00:00:00Z',
                createdByName: 'ops',
              },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          return { data: undefined, isLoading: false, isError: false, refetch() {} }
        },
      }
    }
    if (request === '@/components/cmdb/InstanceBasicInfoTab') return { InstanceBasicInfoTab: () => React.createElement('div', null, '基本信息内容') }
    if (request === '@/components/cmdb/InstanceAssociationsTab') return { InstanceAssociationsTab: () => React.createElement('div', null, '关联关系内容') }
    if (request === '@/components/cmdb/InstanceTopologyTab') return { InstanceTopologyTab: () => React.createElement('div', null, '拓扑图内容') }
    if (request === '@/components/cmdb/InstanceChangeHistoryTab') return { InstanceChangeHistoryTab: () => React.createElement('div', null, '变更历史内容') }
    if (request === '@/components/cmdb/InstanceAlertsTab') return { InstanceAlertsTab: () => React.createElement('div', null, '告警内容') }
    if (request === '@/components/cmdb/InstanceResourcesTab') return { InstanceResourcesTab: () => React.createElement('div', null, '关联资源内容') }
    if (request === '@/components/cmdb/ResourcePoolCapacityCard') return { ResourcePoolCapacityCard: () => null }
    if (request === '@/components/cmdb/RackElevationView') return { RackElevationView: () => null }
    if (request === '@/components/cmdb/RackAssignmentCard') return { RackAssignmentCard: () => null }
    if (request === '@/components/cmdb/EndpointLinksCard') return { EndpointLinksCard: () => null }
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

test('cmdb instance detail leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /\['cmdb-instance', modelCode, id\]/)
  assert.match(page, /\/cmdb\/instances\/\$\{id\}/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /lucide-react/)
  for (const file of tabFiles) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /@\/components\/design-system/)
    assert.doesNotMatch(source, /text-v2-/)
    assert.doesNotMatch(source, /bg-blue-|bg-red-|bg-amber-/)
  }
})

test('cmdb instance detail renders Neutral header and tabs', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /web-01/)
  assert.match(html, /基本信息/)
  assert.match(html, /关联关系/)
  assert.match(html, /影响分析/)
  assert.match(html, /拓扑对比/)
  assert.match(html, /cwgsyw-tabs/)
})
