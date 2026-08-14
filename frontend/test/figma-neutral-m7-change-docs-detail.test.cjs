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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/change-docs/[id]/page.tsx')

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
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ replace() {}, push() {}, back() {} }),
        useParams: () => ({ id: '7' }),
      }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/components/cmdb/CiLinkSelector') {
      return { CiLinkSelector: () => React.createElement('div', null, 'CI 选择器') }
    }
    if (request === '@/lib/api') {
      return {
        get: async () => ({ data: { data: {} } }),
        put: async () => ({}),
        post: async () => ({}),
        delete: async () => ({}),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: (options) => {
          const key = options && options.queryKey ? options.queryKey[0] : ''
          if (key === 'change-doc') {
            return {
              data: {
                id: 7,
                changeNo: 'CHG-2026-0007',
                title: '核心交换机变更',
                status: 'draft',
                applicationTemplateId: 3,
                applicationTemplateName: '网络变更申请单',
                planTemplateId: null,
                planTemplateName: null,
                applicantId: 1,
                applicantName: 'admin',
                applyTime: '2026-08-14 10:00',
                approvedAt: null,
                approverId: null,
                approverName: null,
                approverComment: null,
                createdAt: '2026-08-14T10:00:00Z',
                updatedAt: '2026-08-14T10:00:00Z',
                fieldsData: { title: '升级描述' },
                applicationFieldConfig: [{
                  id: 1,
                  fieldKey: 'title',
                  label: '变更说明',
                  fieldType: 'textarea',
                  sortOrder: 10,
                  required: true,
                  inForm: true,
                  placeholder: '',
                }],
                planFieldConfig: [],
              },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (key === 'change-doc-ci-links') return { data: [], isLoading: false, isError: false, refetch() {} }
          return { data: [], isLoading: false, isError: false, refetch() {} }
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
      const hit = [resolved, resolved + '.tsx', resolved + '.ts', resolved + '/index.ts', resolved + '/index.tsx'].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit) return loadCompiled(hit)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [resolved + '.tsx', resolved + '.ts', resolved].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
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

test('change-docs detail leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['change-doc', id\]/)
  assert.match(page, /\/change-docs\/\$\{id\}/)
  assert.match(page, /\/change-docs\/\$\{id\}\/submit/)
  assert.match(page, /\/change-docs\/\$\{id\}\/approve/)
  assert.match(page, /\/change-docs\/\$\{id\}\/ci-links/)
  assert.match(page, /hasPermission\('change_doc', 'read'\)/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
  const bar = fs.readFileSync(path.join(frontendRoot, 'src/app/(dashboard)/change-docs/[id]/components/DocActionBar.tsx'), 'utf8')
  const picker = fs.readFileSync(path.join(frontendRoot, 'src/app/(dashboard)/change-docs/[id]/components/PlanTemplatePicker.tsx'), 'utf8')
  assert.doesNotMatch(bar, /@\/components\/design-system/)
  assert.doesNotMatch(picker, /@\/components\/design-system/)
})

test('change-docs detail renders Neutral document settings', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /核心交换机变更/)
  assert.match(html, /基本信息/)
  assert.match(html, /变更申请单/)
  assert.match(html, /保存/)
  assert.match(html, /草稿/)
})
