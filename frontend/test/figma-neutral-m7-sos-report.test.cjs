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
const src = (relative) => path.join(frontendRoot, 'src', relative)
const LIST_PAGE = src('app/(dashboard)/sos-reports/page.tsx')
const DETAIL_PAGE = src('app/(dashboard)/sos-reports/[id]/page.tsx')
const FACTS_PANEL = src('app/(dashboard)/sos-reports/[id]/FactsPanel.tsx')
const CMDB_PANEL = src('app/(dashboard)/sos-reports/[id]/CmdbPanel.tsx')
const MAPPINGS_PAGE = src('app/(dashboard)/sos-reports/mappings/page.tsx')
const MAPPING_DIALOG = src('app/(dashboard)/sos-reports/mappings/MappingDialog.tsx')
const PENDING_APPROVALS = src('app/(dashboard)/sos-reports/PendingApprovals.tsx')
const APPROVAL_DIALOG = src('app/(dashboard)/sos-reports/ApprovalDialog.tsx')

const APPROVAL = {
  requestId: 9,
  reportId: 5,
  action: 'create',
  instanceName: 'web-01',
  modelCode: 'host',
  proposedFields: { sn: 'SN-1', cpu_cores: 64 },
  submitterName: '张三',
  createdAt: '2026-11-04T10:00:00',
}

const REPORT = {
  id: 5,
  fileName: 'sosreport-web.tar.xz',
  fileSize: 1048576,
  status: 'parsed',
  hostname: 'web-01',
  primaryIp: '10.0.0.1',
  serialNumber: 'SN-1',
  createdAt: '2026-11-04T10:00:00',
  warnings: ['示例警告'],
  facts: {
    'system.hostname': 'web-01',
    'cpu.sockets': 2,
    'memory.installedGb': 512,
    'network.ipv4Addresses': ['10.0.0.1'],
    'network.interfaces': [{ name: 'bond0', ipv4: ['10.0.0.1/24'], speed: '10000Mb/s' }],
    'network.bonds': [{ name: 'bond0', mode: 'active-backup', status: 'up', members: [{ name: 'eth0', status: 'up' }] }],
    'storage.disks': [{ name: 'sda', sizeGb: 960, model: 'RAID1' }],
    'software.failedServices': ['kdump.service'],
    'software.packageCount': 544,
  },
}

const PREVIEW = {
  modelCode: 'host',
  action: 'update',
  targetInstanceId: 100,
  targetInstanceName: 'web-01',
  instanceName: 'web-01',
  workflowConfigured: false,
  canSubmit: false,
  pendingMappingCount: 1,
  blockingReasons: ['还没有为“SOS 报告入库”配置审批流程，请联系管理员'],
  warnings: [],
  fields: [
    { fieldKey: 'sn', name: '序列号', fieldType: 'singlechar', required: true, editable: false, unique: true, excluded: false, origin: 'preset', value: 'SN-1', currentValue: 'SN-1', changed: false },
    { fieldKey: 'cpu_cores', name: 'CPU核心数', fieldType: 'int', required: false, editable: true, unique: false, excluded: false, origin: 'preset', value: 64, currentValue: 32, changed: true },
    { fieldKey: 'os_type', name: '操作系统', fieldType: 'enum', required: false, editable: true, unique: false, excluded: false, origin: 'preset', value: 'linux', changed: false, options: [{ id: 'linux', name: 'Linux' }] },
    { fieldKey: 'operator', name: '负责人', fieldType: 'objuser', required: false, editable: true, unique: false, excluded: false, origin: 'none', changed: false },
  ],
}

const OVERVIEW = {
  modelCode: 'host',
  pendingCount: 1,
  aiAvailable: true,
  fields: [
    { fieldKey: 'sn', name: '序列号', fieldType: 'singlechar', required: true, unique: true, builtIn: true, supported: true, state: 'preset', factKey: 'system.serialNumber', factLabel: '整机序列号', transform: 'direct' },
    { fieldKey: 'logical_cores', name: '逻辑核', fieldType: 'int', required: false, unique: false, builtIn: false, supported: true, state: 'suggested', source: 'ai', factKey: 'cpu.threads', factLabel: '逻辑 CPU 总数', transform: 'direct', aiVerdict: 'mapped', aiConfidence: 0.9, aiReason: '逻辑线程' },
  ],
}

function compile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
}

function load(filePath, { permissions = () => true, queries = {} } = {}) {
  const originalLoad = Module._load
  const mocks = (request) => {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') {
      return { useRouter: () => ({ replace() {}, push() {} }), useParams: () => ({ id: '5' }), usePathname: () => '/sos-reports/5' }
    }
    if (request === 'next/link') {
      return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    }
    if (request === 'axios') return { __esModule: true, default: { isCancel: () => false } }
    if (request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, message() {} } }
    if (request === '@/hooks/usePermission') {
      return { usePermission: () => ({ isHydrated: true, hasPermission: (resource, action) => permissions(resource, action) }) }
    }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/lib/api' || request === './api') return { __esModule: true, default: {} }
    if (request === '@tanstack/react-query') {
      return {
        keepPreviousData: () => undefined,
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, mutateAsync: async () => {}, isPending: false }),
        useQuery: ({ queryKey }) => ({ isLoading: false, isError: false, refetch() {}, ...(queries[queryKey[0]] ?? {}) }),
      }
    }
    if (request === './Dialog') {
      const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
      const node = ({ children, className }) => React.createElement('div', { className }, children)
      return { Dialog: passthrough, DialogPortal: passthrough, DialogOverlay: node, DialogContent: node, DialogTitle: node, DialogDescription: node, DialogClose: passthrough }
    }
    if (request.startsWith('@base-ui/react/')) {
      const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
      const node = ({ children, className }) => React.createElement('div', { className }, children)
      return {
        Dialog: { Root: passthrough, Portal: passthrough, Backdrop: node, Popup: node, Title: node, Description: node, Close: node },
        Menu: { Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
        Popover: { Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
        Tooltip: { Provider: passthrough, Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
      }
    }
    return null
  }
  function compiled(target) {
    const mod = new Module(target, module)
    mod.filename = target
    mod.paths = Module._nodeModulePaths(path.dirname(target))
    mod._compile(compile(target), target)
    return mod.exports
  }
  Module._load = function patched(request, parent, isMain) {
    const mocked = mocks(request)
    if (mocked) return mocked
    const base = request.startsWith('@/')
      ? src(request.slice(2))
      : request.startsWith('.') && parent?.filename
        ? path.join(path.dirname(parent.filename), request)
        : null
    if (base) {
      const hit = [base, `${base}.tsx`, `${base}.ts`, `${base}/index.ts`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (hit && /\.tsx?$/.test(hit)) return compiled(hit)
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    return compiled(filePath)
  } finally {
    Module._load = originalLoad
  }
}

const render = (filePath, options, props = {}) => {
  const originalLoad = Module._load
  const exports = load(filePath, options)
  const component = exports.default ?? exports[options?.exportName] ?? Object.values(exports)[0]
  try {
    return renderToStaticMarkup(React.createElement(component, props))
  } finally {
    Module._load = originalLoad
  }
}

test('every route has a Neutral page', () => {
  for (const route of ['/sos-reports', '/sos-reports/[id]', '/sos-reports/mappings']) {
    const source = fs.readFileSync(src(`app/(dashboard)${route}/page.tsx`), 'utf8')
    assert.match(source, /figma-neutral\/index\.css/, route)
    assert.match(source, /showBreadcrumb=\{false\}/, route)
    assert.match(source, /hasPermission\('sos_report', 'read'\)/, route)
  }
})

test('format helpers', () => {
  const format = load(src('lib/sos-report-format.ts'))
  assert.equal(format.formatBytes(1048576), '1.0 MB')
  assert.equal(format.formatBytes(null), '—')
  assert.equal(format.hasAcceptedSuffix('A.TAR.XZ'), true)
  assert.equal(format.hasAcceptedSuffix('a.zip'), false)
  assert.equal(format.isFinished('parsed'), true)
  assert.equal(format.isFinished('parsing'), false)
  assert.equal(format.formatValue(['a', 'b']), 'a、b')
  assert.equal(format.formatValue(512, 'GB'), '512 GB')
  assert.equal(format.formatValue(''), '—')
  assert.equal(format.toOverrideValue('bool', 'true'), true)
  assert.equal(format.toOverrideValue('bool', ''), undefined)
  assert.equal(format.toOverrideValue('int', '4'), '4')
  assert.equal(format.isEditableInDraft('table'), false)
  assert.equal(format.isEditableInDraft('singlechar'), true)
  assert.deepEqual(format.enumRowsToMap([{ source: ' a ', target: 'x' }, { source: '', target: 'y' }, { source: 'b', target: '' }]), { a: 'x' })
  assert.deepEqual(format.factRows({ k: [{ a: 1 }, null, 'x'] }, 'k'), [{ a: 1 }])
})

test('list page renders reports and hides actions without permission', () => {
  const queries = { 'sos-reports': { data: { records: [REPORT], total: 1 } } }
  const full = render(LIST_PAGE, { queries })
  assert.match(full, /SOS 报告/)
  assert.match(full, /sosreport-web\.tar\.xz/)
  assert.match(full, /解析成功/)
  assert.match(full, /上传报告/)
  assert.match(full, /删除 sosreport-web/)
  assert.match(full, /href="\/sos-reports\/5"/)

  const readOnly = render(LIST_PAGE, { queries, permissions: (_, action) => action === 'read' })
  assert.doesNotMatch(readOnly, /上传报告/)
  assert.doesNotMatch(readOnly, /删除 sosreport-web/)
})

test('list page empty and error states', () => {
  const empty = render(LIST_PAGE, { queries: { 'sos-reports': { data: { records: [], total: 0 } } } })
  assert.match(empty, /还没有 SOS 报告/)

  const error = render(LIST_PAGE, { queries: { 'sos-reports': { isError: true, error: new Error('服务不可用') } } })
  assert.match(error, /服务不可用/)
  assert.match(error, /重试/)
})

test('detail page shows parse failure without tabs', () => {
  const html = render(DETAIL_PAGE, { queries: { 'sos-report': { data: { ...REPORT, status: 'failed', errorMessage: '归档已损坏', facts: undefined, hostname: undefined } } } })
  assert.match(html, /解析失败/)
  assert.match(html, /归档已损坏/)
  assert.doesNotMatch(html, /role="tab"/)
})

test('detail page shows facts and warnings once parsed', () => {
  const html = render(DETAIL_PAGE, { queries: { 'sos-report': { data: REPORT } } })
  assert.match(html, /web-01/)
  assert.match(html, /示例警告/)
  assert.match(html, /结构化数据/)
  assert.match(html, /CMDB 入库/)
  assert.match(html, /512 GB/)
})

test('facts panel handles missing data', () => {
  const html = render(FACTS_PANEL, {}, { report: { ...REPORT, facts: {} } })
  assert.match(html, /报告中没有网卡信息/)
  assert.match(html, /没有配置 bond/)
  assert.match(html, /没有失败的服务/)
})

test('facts panel lists failed services and bond members', () => {
  const html = render(FACTS_PANEL, {}, { report: REPORT })
  assert.match(html, /kdump\.service/)
  assert.match(html, /eth0（up）/)
  assert.match(html, /RAID1/)
})

test('cmdb panel shows diff and blocks submit when workflow is missing', () => {
  const html = render(CMDB_PANEL, { queries: { 'sos-report-cmdb-preview': { data: PREVIEW }, 'sos-report-cmdb-requests': { data: [] } } }, { reportId: '5' })
  assert.match(html, /更新实例/)
  assert.match(html, /href="\/cmdb\/instances\/by-model\/host\/100"/)
  assert.match(html, /配置审批流程/)
  assert.match(html, /CMDB 现有值/)
  assert.match(html, /将更新/)
  assert.doesNotMatch(html, /负责人/, '没有值、又不能在这里填写的字段不显示')
  assert.match(html, /还没有入库申请/)
  assert.match(html, /前往配置字段映射规则/)
  assert.match(html, /<button[^>]*disabled[^>]*>[\s\S]{0,120}提交审批/)
})

test('cmdb panel hides submit controls without permission', () => {
  const html = render(CMDB_PANEL, {
    permissions: (_, action) => action === 'read',
    queries: { 'sos-report-cmdb-preview': { data: PREVIEW }, 'sos-report-cmdb-requests': { data: [] } },
  }, { reportId: '5' })
  assert.doesNotMatch(html, /提交审批/)
  assert.doesNotMatch(html, /<input[^>]*aria-label="填写 CPU核心数"/)
})

test('cmdb panel never offers editing a non-editable field on update', () => {
  const html = render(CMDB_PANEL, { queries: { 'sos-report-cmdb-preview': { data: PREVIEW }, 'sos-report-cmdb-requests': { data: [] } } }, { reportId: '5' })
  assert.doesNotMatch(html, /aria-label="填写 序列号"/)
  assert.match(html, /aria-label="填写 CPU核心数"/)
})

test('cmdb panel shows request history with result link', () => {
  const requests = [{ id: 9, reportId: 5, action: 'create', instanceName: 'web-01', status: 'applied', resultInstanceId: 100, createdAt: '2026-11-04T10:00:00', proposedFields: {} },
    { id: 8, reportId: 5, action: 'create', instanceName: 'web-01', status: 'apply_failed', failureMessage: '字段 序列号 的值已存在', createdAt: '2026-11-03T10:00:00', proposedFields: {} }]
  const html = render(CMDB_PANEL, { queries: { 'sos-report-cmdb-preview': { data: PREVIEW }, 'sos-report-cmdb-requests': { data: requests } } }, { reportId: '5' })
  assert.match(html, /已入库/)
  assert.match(html, /查看实例 #100/)
  assert.match(html, /写入失败/)
  assert.match(html, /值已存在/)
})

test('mappings page states what is sent to AI and marks suggestions as unconfirmed', () => {
  const html = render(MAPPINGS_PAGE, { queries: { 'sos-report-mappings': { data: OVERVIEW }, 'sos-report-fact-catalog': { data: { facts: [], transforms: [] } } } })
  assert.match(html, /不发送任何主机的数据/)
  assert.match(html, /AI 建议待确认/)
  assert.match(html, /审核/)
  assert.match(html, /有待处理的字段/)
  assert.doesNotMatch(html, /配置 序列号/, '预置字段不能配置')
})

test('mappings page works without AI and without manage permission', () => {
  const noAi = render(MAPPINGS_PAGE, { queries: { 'sos-report-mappings': { data: { ...OVERVIEW, aiAvailable: false } }, 'sos-report-fact-catalog': { data: { facts: [], transforms: [] } } } })
  assert.match(noAi, /AI 服务未启用/)
  assert.match(noAi, /<button[^>]*disabled[^>]*>[\s\S]{0,120}AI 生成建议/)

  const readOnly = render(MAPPINGS_PAGE, {
    permissions: (_, action) => action === 'read',
    queries: { 'sos-report-mappings': { data: OVERVIEW }, 'sos-report-fact-catalog': { data: { facts: [], transforms: [] } } },
  })
  assert.doesNotMatch(readOnly, /AI 生成建议/)
  assert.doesNotMatch(readOnly, /审核/)
})

test('mapping dialog shows AI reasoning and warns on unique fields', () => {
  const catalog = { facts: [{ key: 'cpu.threads', label: '逻辑 CPU 总数', type: 'INTEGER' }], transforms: [{ code: 'direct', label: '直接取值' }] }
  const html = render(MAPPING_DIALOG, {}, { field: { ...OVERVIEW.fields[1], unique: true }, catalog, onClose() {} })
  assert.match(html, /AI 判断/)
  assert.match(html, /置信度 90%/)
  assert.match(html, /这是唯一字段/)
  assert.match(html, /确认规则/)
  assert.match(html, /标记无法映射/)
})

test('pending approvals appear only when there is something to approve', () => {
  assert.equal(render(PENDING_APPROVALS, { exportName: 'PendingApprovals', queries: { 'sos-report-approvals': { data: [] } } }), '')

  const html = render(PENDING_APPROVALS, { exportName: 'PendingApprovals', queries: { 'sos-report-approvals': { data: [APPROVAL] } } })
  assert.match(html, /待我审批（1）/)
  assert.match(html, /审批 web-01/)
  assert.match(html, /href="\/sos-reports\/5"/)
})

test('list page shows the approval queue', () => {
  const html = render(LIST_PAGE, { queries: { 'sos-reports': { data: { records: [], total: 0 } }, 'sos-report-approvals': { data: [APPROVAL] } } })
  assert.match(html, /待我审批/)
})

test('approval dialog shows exactly what will be written', () => {
  const html = render(APPROVAL_DIALOG, {}, { approval: APPROVAL, onClose() {} })
  assert.match(html, /审批入库：web-01/)
  assert.match(html, /通过后将新增实例/)
  assert.match(html, /SN-1/)
  assert.match(html, /通过并写入 CMDB/)
  assert.match(html, /驳回/)
})

test('approval dialog marks which fields came from AI suggestions', () => {
  const approval = {
    ...APPROVAL,
    action: 'update',
    targetInstanceId: 100,
    fieldDetails: [
      { fieldKey: 'cpu_cores', name: 'CPU核心数', value: 64, currentValue: 32, origin: 'preset', factLabel: '物理核心总数' },
      { fieldKey: 'logical_cores', name: '逻辑核', value: 128, origin: 'confirmed', factLabel: '逻辑 CPU 总数', ruleSource: 'ai', aiConfidence: 0.9, aiReason: '名称对应逻辑线程' },
      { fieldKey: 'rack', name: '机柜', value: 'A1', origin: 'manual' },
    ],
  }
  const html = render(APPROVAL_DIALOG, {}, { approval, onClose() {} })
  assert.match(html, /1 个字段使用了 AI 建议的映射规则，请重点核对/)
  assert.match(html, /AI 建议的规则（已人工确认）/)
  assert.match(html, /置信度 90%：名称对应逻辑线程/)
  assert.match(html, /CMDB 现有值/)
  assert.match(html, /CPU核心数/, '显示字段名而不是 key')
  assert.doesNotMatch(html, /cpu_cores/)
  assert.match(html, /人工填写/)
})

test('approval dialog says so when no AI was involved', () => {
  const approval = { ...APPROVAL, fieldDetails: [{ fieldKey: 'sn', name: '序列号', value: 'SN-1', origin: 'preset' }] }
  const html = render(APPROVAL_DIALOG, {}, { approval, onClose() {} })
  assert.match(html, /没有使用 AI 建议/)
  assert.doesNotMatch(html, /AI 建议的规则（已人工确认）/)
})

test('approval queue and report banner surface AI involvement', () => {
  const approval = { ...APPROVAL, fieldDetails: [{ fieldKey: 'a', name: 'A', origin: 'confirmed', ruleSource: 'ai' }] }
  const queue = render(PENDING_APPROVALS, { exportName: 'PendingApprovals', queries: { 'sos-report-approvals': { data: [approval] } } })
  assert.match(queue, /AI 参与/)
  assert.match(queue, /1 个字段/)

  const { ReportApprovalBanner } = load(PENDING_APPROVALS, { queries: { 'sos-report-approvals': { data: [approval] } } })
  const banner = renderToStaticMarkup(React.createElement(ReportApprovalBanner, { reportId: 5 }))
  assert.match(banner, /待你审批/)
  assert.match(banner, /1 个字段的规则来自 AI 建议/)
  assert.equal(renderToStaticMarkup(React.createElement(ReportApprovalBanner, { reportId: 6 })), '')
})

test('cmdb panel warns the submitter about AI suggested rules', () => {
  const preview = { ...PREVIEW, fields: [...PREVIEW.fields, { fieldKey: 'logical_cores', name: '逻辑核', fieldType: 'int', required: false, editable: true, unique: false, excluded: false, origin: 'confirmed', ruleSource: 'ai', aiConfidence: 0.9, value: 128, changed: true }] }
  const html = render(CMDB_PANEL, { queries: { 'sos-report-cmdb-preview': { data: preview }, 'sos-report-cmdb-requests': { data: [] } } }, { reportId: '5' })
  assert.match(html, /1 个字段的映射规则来自 AI 建议/)
  assert.match(html, /AI 建议的规则/)
})

test('sos report notifications are clickable', () => {
  const item = fs.readFileSync(src('components/notification/NotificationItem.tsx'), 'utf8')
  const target = fs.readFileSync(src('app/(dashboard)/notifications/targets/[refType]/[refId]/page.tsx'), 'utf8')
  assert.match(item, /'sos_report'/)
  assert.match(target, /sos_report: async/)
})

test('navigation, route guard, breadcrumb, role grouping and workflow lists are wired', () => {
  const read = (relative) => fs.readFileSync(src(relative), 'utf8')
  assert.match(read('components/layout/sidebar/navItems.ts'), /href: '\/sos-reports'.*resource: 'sos_report', action: 'read'/)
  assert.match(read('app/(dashboard)/layout.tsx'), /path: '\/sos-reports', permissions: \['sos_report:read'\]/)
  assert.match(read('lib/breadcrumb-config.ts'), /pattern: '\/sos-reports\/mappings'/)
  assert.match(read('components/rbac/RoleDialog.tsx'), /'sos_report'/)
  assert.match(read('app/(dashboard)/workflow/bindings/page.tsx'), /sos_cmdb_request/)
  assert.match(read('app/(dashboard)/workflow/templates/page.tsx'), /sos_cmdb_request/)
})

test('upload path only loosens the body limit for itself', () => {
  for (const name of ['nginx.dev.conf', 'nginx.prod.conf']) {
    const conf = fs.readFileSync(path.join(frontendRoot, '..', 'nginx', name), 'utf8')
    assert.match(conf, /location = \/api\/sos-reports\/upload \{[\s\S]*?client_max_body_size 200m;/, name)
    assert.doesNotMatch(conf, /location \/api \{[^}]*client_max_body_size/, name)
  }
})

test('api client does not send snake_case fields', () => {
  const client = fs.readFileSync(src('lib/sos-report-api.ts'), 'utf8')
  assert.doesNotMatch(client, /[a-z]_[a-z]+:/)
})
