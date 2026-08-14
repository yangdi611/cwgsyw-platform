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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/files/page.tsx')
const treePath = path.join(frontendRoot, 'src/app/(dashboard)/files/components/FolderTreeNode.tsx')
const auditPath = path.join(frontendRoot, 'src/app/(dashboard)/files/components/AuditPanel.tsx')
const previewPath = path.join(frontendRoot, 'src/app/(dashboard)/files/preview/[id]/page.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ push() {}, replace() {} }) }
    if (request === 'next/link') {
      return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === 'axios') return { isCancel: () => false }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, mutateAsync: async () => ({}), isPending: false, variables: undefined }),
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'file-folders') {
            return {
              data: {
                data: [
                  {
                    id: 3,
                    name: '运维文档',
                    parentId: null,
                    aclCustom: false,
                    canCreateChild: true,
                    canUpload: true,
                    canDelete: true,
                    canUpdate: true,
                    canManageAcl: true,
                    children: [],
                  },
                ],
              },
              isLoading: false,
            }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'files') {
            return {
              data: {
                data: {
                  records: [
                    {
                      id: 12,
                      name: '巡检手册.pdf',
                      originalName: '巡检手册.pdf',
                      fileType: 'pdf',
                      sizeBytes: 2048,
                      folderId: 3,
                      createdByName: 'admin',
                      createdAt: '2026-01-04T08:00:00Z',
                      canDelete: true,
                      canManageAcl: true,
                    },
                  ],
                  total: 1,
                },
              },
              isLoading: false,
            }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'authorization-groups') {
            return { data: [{ id: 2, name: '主机组' }], isLoading: false }
          }
          return { data: { data: { records: [] } }, isLoading: false }
        },
      }
    }
    if (request === '@/hooks/usePermission') {
      return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    }
    if (request === '@/lib/shared-file-content') return { downloadSharedFile: async () => {} }
    if (request === '@/components/authorization/ResourceAccessDialog') {
      return { ResourceAccessDialog: () => null }
    }
    if (request === '@/lib/api') {
      return {
        default: {
          get: async () => ({ data: { data: [] } }),
          post: async () => ({}),
          put: async () => ({}),
          patch: async () => ({}),
          delete: async () => ({}),
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
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit) return loadCompiled(hit)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
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

test('files page leaves old visual entries and keeps file APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const tree = fs.readFileSync(treePath, 'utf8')
  const audit = fs.readFileSync(auditPath, 'utf8')
  const preview = fs.readFileSync(previewPath, 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['file-folders'\]/)
  assert.match(page, /queryKey: \['files', selectedFolderId, search, page\]/)
  assert.match(page, /\/files\/upload/)
  assert.match(page, /\/files\/folders/)
  assert.match(page, /downloadSharedFile/)
  assert.match(page, /ResourceAccessDialog/)
  assert.doesNotMatch(page, /confirm\(/)
  assert.doesNotMatch(tree, /confirm\(/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(tree, /@\/components\/design-system/)
  assert.doesNotMatch(audit, /@\/components\/design-system/)
  assert.match(preview, /DetailDrawerPage/)
  assert.doesNotMatch(preview, /@\/components\/design-system/)
})

test('files page renders Neutral split workspace, folders and files', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /共享文档/)
  assert.match(html, /运维文档/)
  assert.match(html, /巡检手册\.pdf/)
  assert.match(html, /全部文件/)
  assert.doesNotMatch(html, /<main/)
})
