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
const pagePath = path.join(
  frontendRoot,
  'src/app/(dashboard)/tasks/templates/[templateId]/versions/[versionId]/page.tsx',
)
const designerPath = path.join(frontendRoot, 'src/components/task-template/TaskTemplateDesigner.tsx')
const libraryPath = path.join(frontendRoot, 'src/components/task-template/FieldLibrary.tsx')
const canvasPath = path.join(frontendRoot, 'src/components/task-template/FormCanvas.tsx')
const panelPath = path.join(frontendRoot, 'src/components/task-template/FieldPropertyPanel.tsx')

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

function versionDetail(status = 'draft') {
  return {
    id: 21,
    templateId: 7,
    version: 2,
    status,
    name: '巡检模板 v2',
    description: '第二版巡检',
    instructions: '按机房逐项填写',
    layout: { sections: [{ key: 'main', title: '任务内容', columns: 1 }] },
    completionPolicy: {},
    defaultAssignment: {},
    defaultReminder: {},
    updatedAt: '2026-08-14T12:00:00Z',
    fields: [
      {
        key: 'room',
        label: '机房',
        type: 'text',
        required: true,
        sensitive: false,
        analytics: { enabled: false },
        condition: {},
        formula: {},
        validation: {},
      },
    ],
  }
}

function fieldTypes() {
  return [{ type: 'text', label: '单行文本', category: '基础', aggregations: [], supportsDimension: true, supportsAnalytics: true, supportsSensitive: true }]
}

function loadCompiled(filePath, status = 'draft') {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ push() {}, refresh() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/lib/api-error') return { getApiErrorMessage: () => 'error', isAxiosError: () => false }
    if (request === '@/lib/task-template-api') {
      return {
        getTaskTemplateVersion: async () => versionDetail(status),
        listTaskFieldTypes: async () => fieldTypes(),
        updateTaskTemplateVersion: async (_id, payload) => ({ ...versionDetail(status), ...payload }),
        validateTaskTemplateVersion: async () => ({ valid: true, issues: [] }),
        publishTaskTemplateVersion: async () => versionDetail('published'),
        previewTaskTemplateVersion: async () => ({ schema: { name: 'preview', description: '', fields: [] }, requiredFields: {}, computedValues: {}, valueIssues: [] }),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ setQueryData() {}, invalidateQueries() {} }),
        useQuery: ({ queryKey }) => {
          if (queryKey[0] === 'task-template-version') {
            return { data: versionDetail(status), isLoading: false, isError: false, refetch() {} }
          }
          if (queryKey[0] === 'task-field-types') {
            return { data: fieldTypes(), isLoading: false, isError: false, refetch() {} }
          }
          return { data: undefined, isLoading: false, isError: false, refetch() {} }
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
      if (hit) return loadCompiled(hit, status)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit, status)
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

test('task template version designer leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const designer = fs.readFileSync(designerPath, 'utf8')
  const library = fs.readFileSync(libraryPath, 'utf8')
  const canvas = fs.readFileSync(canvasPath, 'utf8')
  const panel = fs.readFileSync(panelPath, 'utf8')
  assert.match(page, /TaskTemplateDesigner/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(designer, /figma-neutral\/index\.css/)
  assert.match(designer, /queryKey: \['task-template-version', versionId\]/)
  assert.match(designer, /queryKey: \['task-field-types'\]/)
  assert.match(designer, /getTaskTemplateVersion/)
  assert.match(designer, /updateTaskTemplateVersion/)
  assert.match(designer, /validateTaskTemplateVersion/)
  assert.match(designer, /publishTaskTemplateVersion/)
  assert.match(designer, /previewTaskTemplateVersion/)
  assert.doesNotMatch(designer, /<Card/)
  assert.match(designer, /showSubtitle=\{false\}/)
  for (const source of [designer, library, canvas, panel]) {
    assert.doesNotMatch(source, /@\/components\/design-system/)
    assert.doesNotMatch(source, /@\/components\/shared/)
    assert.doesNotMatch(source, /text-v2-/)
    assert.doesNotMatch(source, /lucide-react/)
  }
})

test('draft template version renders Neutral designer and stays editable', () => {
  const designer = loadCompiled(designerPath, 'draft')
  const html = renderToStaticMarkup(React.createElement(designer.TaskTemplateDesigner, { templateId: 7, versionId: 21 }))
  assert.match(html, /巡检模板 v2/)
  assert.match(html, /字段组件库/)
  assert.match(html, /表单画布/)
  assert.match(html, /字段配置/)
  assert.match(html, /保存/)
  assert.match(html, /校验/)
  assert.match(html, /发布并锁定/)
  assert.match(html, /机房/)
  assert.doesNotMatch(html, /此版本已发布或废弃/)
})

test('published template version stays read-only', () => {
  const designer = loadCompiled(designerPath, 'published')
  const html = renderToStaticMarkup(React.createElement(designer.TaskTemplateDesigner, { templateId: 7, versionId: 21 }))
  assert.match(html, /此版本已发布或废弃，只读展示不可变快照/)
  assert.match(html, /cwgsyw-tasks-panel/)
  assert.match(html, /已发布/)
  assert.doesNotMatch(html, />保存</)
  assert.doesNotMatch(html, />校验</)
  assert.doesNotMatch(html, />发布并锁定</)
})
