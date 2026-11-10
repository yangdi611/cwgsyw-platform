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

function load(filePath, { permissions = () => true, queries = {}, extraMocks = {} } = {}) {
  const originalLoad = Module._load
  const mocks = (request) => {
    if (extraMocks[request]) return extraMocks[request]
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

test('detail modules use the same light panel as other detail pages', () => {
  for (const file of [FACTS_PANEL, CMDB_PANEL, PENDING_APPROVALS]) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\bCard\b/, path.basename(file))
  }

  const facts = render(FACTS_PANEL, {}, { report: REPORT })
  for (const title of ['主机身份', '硬件', '操作系统', '网络', '网卡', '磁盘', '监听端口']) {
    assert.match(facts, new RegExp(`cwgsyw-devices-panel__head">${title}<`), title)
  }
  // Table 窄屏时每行是一个 cwgsyw-card；只有 Card 组件才带 --sm/--md/--lg 修饰类。
  assert.doesNotMatch(facts, /cwgsyw-card--/)
  assert.doesNotMatch(facts, /cwgsyw-type-title-sm/, '模块标题不能用 20px 的卡片标题')
  assert.match(facts, /<h2[^>]*>基本信息<\/h2>/)
  assert.match(facts, /<h2[^>]*>存储<\/h2>/)
  assert.match(facts, /<h2[^>]*>网络明细<\/h2>/)
  assert.match(facts, /<h2[^>]*>服务<\/h2>/)

  const cmdb = render(CMDB_PANEL, { queries: { 'sos-report-cmdb-preview': { data: PREVIEW }, 'sos-report-cmdb-requests': { data: [] } } }, { reportId: '5' })
  for (const title of ['入库方式', '字段值', '入库申请记录']) {
    assert.match(cmdb, new RegExp(`cwgsyw-devices-panel__head">${title}<`), title)
  }
  assert.doesNotMatch(cmdb, /cwgsyw-card--/)

  const queue = render(PENDING_APPROVALS, { exportName: 'PendingApprovals', queries: { 'sos-report-approvals': { data: [APPROVAL] } } })
  assert.match(queue, /cwgsyw-devices-panel__head">待我审批（1）</)
})

test('tables fill their module instead of adding a second border', () => {
  const html = render(FACTS_PANEL, {}, { report: REPORT })
  assert.match(html, /cwgsyw-sos-report__panel-flush/)

  const css = fs.readFileSync(src('design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(css, /\.cwgsyw-sos-report__panel-flush \.cwgsyw-cmdb-table \.cwgsyw-table-wrap \{\s*border: 0;/)

  // 贴满模块后，窄屏行卡片和空状态提示都不能贴到外框上。
  assert.match(css, /\.cwgsyw-sos-report__panel-flush \.cwgsyw-table-mobile \{ padding: var\(--cwgsyw-space-3\); \}/)
  assert.match(css, /\.cwgsyw-sos-report__panel-flush \.cwgsyw-cmdb-table > div:not\(\[class\]\) \{\s*padding: var\(--cwgsyw-space-3\);/)
  assert.match(render(FACTS_PANEL, {}, { report: { ...REPORT, facts: {} } }), /<div class="cwgsyw-cmdb-table"><div>没有配置 bond<\/div>/, '样式依赖这个结构')
})

test('sos report styles use design tokens for spacing', () => {
  const css = fs.readFileSync(src('design-system/figma-neutral/components/patterns.css'), 'utf8')
  const rules = css.slice(css.indexOf('/* SOS 报告 */')).match(/[^{}]*cwgsyw-sos-report[^{}]*\{[^}]*\}/g)
  assert.ok(rules.length >= 8)
  for (const rule of rules) {
    assert.doesNotMatch(rule, /(?:gap|margin|padding|font-size|line-height)\s*:\s*[^;]*\b[1-9]\d*px/, rule)
  }
})

test('package count moves into basic information', () => {
  const html = render(FACTS_PANEL, {}, { report: REPORT })
  assert.match(html, /<dt>软件包<\/dt><dd>544 个<\/dd>/)
  assert.doesNotMatch(html, /cwgsyw-devices-panel__head">软件包</)
})

const HARDWARE_FACTS = {
  ...REPORT.facts,
  'health.issues': ['物理盘 /c0/e252/s3 状态：Offln'],
  'memory.slotsTotal': 2,
  'hardware.memoryModules': [
    { locator: 'A1', installed: true, status: '已安装', sizeGb: 32, manufacturer: 'Samsung（80CE）', partNumber: 'M393A4K40CB2-CVF' },
    { locator: 'B1', installed: false, status: '空槽位' },
  ],
  'hardware.pciSlots': [
    { designation: 'PCIe Slot 1', installed: true, busAddress: '3b:00.0', deviceCategory: 'RAID 控制器', deviceModel: 'MegaRAID SAS 9361-8i' },
    { designation: 'PCIe Slot 2', installed: false, status: '空槽位' },
  ],
  'hardware.firmwareInventory': [{ category: 'RAID 卡', component: 'AVAGO MegaRAID SAS 9361-8i', location: '控制器 0（PCIe Slot 1）', version: '4.680.00-8417' }],
  'storage.raidControllers': [{ tool: 'storcli', controller: '0', model: 'AVAGO MegaRAID SAS 9361-8i', firmwareVersion: '4.680.00-8417' }],
  'storage.raidPhysicalDrives': [
    { controller: '0', location: '/c0/e252/s0', installed: true, state: 'Onln', serialNumber: 'PHDV1' },
    { controller: '0', location: '/c0/e252/s4', installed: false, state: '空槽位', inferred: true },
  ],
  'hardware.pciDevices': [{ address: '01:00.0', category: '以太网卡', vendor: 'Mucse（沐创）', vendorId: '8848', deviceId: '1000', source: 'udev' }],
  'os.kdumpStatus': 'not_operational',
  'os.ntpSynchronized': false,
  'network.interfaces': [{ name: 'ens5f0', transceiver: { vendor: 'FINISAR CORP.', partNumber: 'FTLX8571D3BCL' } }],
}

test('facts panel groups hardware details into tabs and shows empty slots', () => {
  const html = render(FACTS_PANEL, {}, { report: { ...REPORT, facts: HARDWARE_FACTS } })
  for (const tab of ['概览（1 项告警）', '硬件部件', '存储', '网络', 'BMC 与传感器', '系统与软件']) {
    assert.match(html, new RegExp(`role="tab"[^>]*>(?:<[^>]+>)*${tab.replace(/[()（）]/g, '.')}<`), tab)
  }
  assert.match(html, /物理盘 \/c0\/e252\/s3 状态：Offln/)
  assert.match(html, /内存插槽（已用 1 \/ 共 2）/)
  assert.match(html, /PCIe 插槽（已用 1 \/ 共 2）/)
  assert.match(html, /RAID 物理盘（已用 1 \/ 共 2）/)
  assert.match(html, /cwgsyw-chip[^"]*"[^>]*>(?:<[^>]+>)*空槽位/, '空槽位用标签标出')
  assert.match(html, /Samsung（80CE）/)
  assert.match(html, /MegaRAID SAS 9361-8i/, '插槽表显示插在槽里的设备')
  assert.match(html, /PCI ID 8848:1000/, '没有型号名称时 PCI 表显示 PCI ID')
  assert.match(html, /4\.680\.00-8417/)
  assert.match(html, /FTLX8571D3BCL/, '光模块单独成表')
  assert.match(html, /<dt>kdump<\/dt><dd>未就绪<\/dd>/)
  assert.match(html, /<dt>时钟已同步<\/dt><dd>否<\/dd>/)
})

test('vendor specific tables stay hidden without data', () => {
  const html = render(FACTS_PANEL, {}, { report: { ...REPORT, facts: {} } })
  assert.match(html, /报告中没有 RAID 卡信息/)
  assert.match(html, /报告中没有 BMC 信息/)
  assert.match(html, /解析中没有发现告警/)
  for (const title of ['InfiniBand', '光纤通道', '多路径设备', 'GPU 与加速卡', 'RAID 物理盘', '光模块']) {
    assert.doesNotMatch(html, new RegExp(`cwgsyw-devices-panel__head">${title}`), title)
  }
})

test('fact values format booleans and enum labels', () => {
  const format = load(src('lib/sos-report-format.ts'))
  assert.equal(format.formatFactValue(true), '是')
  assert.equal(format.formatFactValue('enabled', undefined, { enabled: '已开启' }), '已开启')
  assert.equal(format.formatFactValue({ vendor: 'A', partNumber: 'B', empty: '' }), 'A / B')
  assert.equal(format.formatFactValue(32, 'GB'), '32 GB')
  assert.equal(format.isEmptySlot({ installed: false }), true)
  assert.equal(format.isEmptySlot({}), false)
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

test('upload paths only loosen the body limit for themselves', () => {
  for (const name of ['nginx.dev.conf', 'nginx.prod.conf']) {
    const conf = fs.readFileSync(path.join(frontendRoot, '..', 'nginx', name), 'utf8')
    assert.match(conf, /location = \/api\/sos-reports\/upload \{[\s\S]*?client_max_body_size 200m;/, name)
    assert.match(conf, /location \/api\/sos-reports\/uploads \{[^}]*client_max_body_size 2m;/, name)
    assert.doesNotMatch(conf, /location \/api \{[^}]*client_max_body_size/, name)
  }
})

const CHUNK = 1024 * 1024

/** 假的 axios 客户端：按路径记录请求，可以让某个请求按顺序失败若干次。 */
function fakeClient({ size, failures = {} }) {
  const calls = { chunks: [], deleted: [], completed: 0, started: [] }
  const remaining = { ...failures }
  const failIfScripted = (key) => {
    const queue = remaining[key]
    if (queue?.length) throw queue.shift()
  }
  return {
    calls,
    post: async (url, body) => {
      if (url === '/sos-reports/uploads') {
        calls.started.push(body)
        failIfScripted('start')
        return { data: { data: { uploadId: 'u1', chunkSize: CHUNK, chunkCount: Math.ceil(size / CHUNK) } } }
      }
      if (url.includes('/chunks/')) {
        const index = Number(url.split('/').pop())
        failIfScripted(`chunk${index}`)
        calls.chunks.push({ index, url, bytes: Buffer.from(await body.get('chunk').arrayBuffer()) })
        return { data: {} }
      }
      assert.equal(url, '/sos-reports/uploads/u1/complete')
      calls.completed += 1
      failIfScripted('complete')
      return { data: { data: { id: 5 } } }
    },
    delete: async (url) => {
      calls.deleted.push(url)
      return { data: {} }
    },
  }
}

function bytes(size) {
  const content = Buffer.alloc(size)
  for (let i = 0; i < size; i += 1) content[i] = (i + Math.floor(i / 1024)) % 251
  return content
}

const httpError = (status, data) => Object.assign(new Error(`status ${status}`), { response: { status, data } })
const networkError = () => Object.assign(new Error('Network Error'), { response: undefined })
const noWait = async () => {}
const uploadModule = () => load(src('lib/sos-report-upload.ts'))

test('upload slices the file into 1 MB chunks that reassemble exactly', async () => {
  const { uploadSosReport } = uploadModule()
  const content = bytes(CHUNK * 2 + 500)
  const client = fakeClient({ size: content.length })

  const report = await uploadSosReport(new File([content], 'a.tar.xz'), () => {}, new AbortController().signal, { client, wait: noWait })

  assert.equal(report.id, 5)
  assert.deepEqual(client.calls.chunks.map((chunk) => chunk.bytes.length), [CHUNK, CHUNK, 500])
  assert.deepEqual(client.calls.chunks.map((chunk) => chunk.index), [0, 1, 2])
  assert.ok(Buffer.concat(client.calls.chunks.map((chunk) => chunk.bytes)).equals(content))
  assert.equal(client.calls.completed, 1)
  assert.deepEqual(client.calls.deleted, [])
  assert.equal(client.calls.started[0].fileName, 'a.tar.xz')
  assert.equal(client.calls.started[0].fileSize, content.length)
  assert.equal(client.calls.started[0].sha256, require('node:crypto').createHash('sha256').update(content).digest('hex'))
})

test('progress only counts chunks the server confirmed', async () => {
  const { uploadSosReport } = uploadModule()
  const content = bytes(CHUNK * 2)
  const client = fakeClient({ size: content.length })
  const seen = []
  let clock = 0

  await uploadSosReport(new File([content], 'a.tar.xz'), (progress) => {
    seen.push({ ...progress, confirmed: client.calls.chunks.length, completed: client.calls.completed })
  }, new AbortController().signal, { client, wait: noWait, now: () => (clock += 70_000) })

  const uploading = seen.filter((progress) => progress.phase === 'uploading')
  assert.deepEqual(uploading.map((progress) => progress.percent), [0, 50, 100])
  assert.deepEqual(uploading.map((progress) => progress.confirmed), [0, 1, 2])
  assert.equal(uploading[1].remainingSeconds, 70)
  assert.equal(seen.at(-1).phase, 'assembling')
  assert.equal(seen.at(-1).completed, 0, '合并状态要在调用完成接口之前显示')
})

test('a chunk that hits Cloudflare or network failures is retried and not skipped', async () => {
  const { uploadSosReport } = uploadModule()
  const content = bytes(CHUNK + 10)
  const client = fakeClient({ size: content.length, failures: { chunk0: [httpError(524, { message: 'timeout' }), networkError()] } })
  const waits = []

  await uploadSosReport(new File([content], 'a.tar.xz'), () => {}, new AbortController().signal, {
    client,
    wait: async (ms) => { waits.push(ms) },
  })

  assert.deepEqual(client.calls.chunks.map((chunk) => chunk.index), [0, 1])
  assert.deepEqual(waits, [2000, 5000])
})

test('complete waits while the server is still assembling', async () => {
  const { uploadSosReport } = uploadModule()
  const content = bytes(10)
  const client = fakeClient({ size: 10, failures: { complete: [networkError(), httpError(409, { errorCode: 'SOS_UPLOAD_ASSEMBLING', message: '合并中' })] } })

  const report = await uploadSosReport(new File([content], 'a.tar.xz'), () => {}, new AbortController().signal, { client, wait: noWait })

  assert.equal(report.id, 5)
  assert.equal(client.calls.completed, 3)
})

test('a permanent rejection stops at once and removes the partial upload', async () => {
  const { uploadSosReport } = uploadModule()
  const content = bytes(CHUNK + 10)
  const rejected = httpError(400, { errorCode: 'SOS_REPORT_FORMAT', message: '文件内容不是压缩包' })
  const client = fakeClient({ size: content.length, failures: { chunk0: [rejected] } })

  await assert.rejects(uploadSosReport(new File([content], 'a.tar.xz'), () => {}, new AbortController().signal, { client, wait: noWait }), rejected)

  assert.equal(client.calls.chunks.length, 0)
  assert.deepEqual(client.calls.deleted, ['/sos-reports/uploads/u1'])
})

test('retries give up eventually and the failure is readable', async () => {
  const { uploadSosReport, describeUploadError } = uploadModule()
  const content = bytes(10)
  const cloudflare = httpError(524, { message: 'did not return a complete response within the 120-second window' })
  const client = fakeClient({ size: 10, failures: { chunk0: Array(5).fill(cloudflare) } })

  await assert.rejects(uploadSosReport(new File([content], 'a.tar.xz'), () => {}, new AbortController().signal, { client, wait: noWait }), cloudflare)

  assert.deepEqual(client.calls.deleted, ['/sos-reports/uploads/u1'])
  assert.match(describeUploadError(cloudflare), /网络不稳定或服务器响应超时/)
  assert.doesNotMatch(describeUploadError(cloudflare), /120-second/)
  assert.match(describeUploadError(networkError()), /网络不稳定/)
  assert.equal(describeUploadError(httpError(409, { errorCode: 'SOS_REPORT_DUPLICATE', message: '这份报告已经上传过' })), '这份报告已经上传过')
  assert.equal(describeUploadError(httpError(403, '<html>')), '上传请求被拒绝（HTTP 403）')
})

test('duplicate detected at start never creates an upload to clean up', async () => {
  const { uploadSosReport } = uploadModule()
  const rejected = httpError(409, { errorCode: 'SOS_REPORT_DUPLICATE', message: '这份报告已经上传过' })
  const client = fakeClient({ size: 10, failures: { start: [rejected] } })

  await assert.rejects(uploadSosReport(new File([bytes(10)], 'a.tar.xz'), () => {}, new AbortController().signal, { client, wait: noWait }), rejected)

  assert.equal(client.calls.chunks.length, 0)
  assert.deepEqual(client.calls.deleted, [])
})

test('cancelling stops uploading, removes the partial upload and reports cancellation', async () => {
  const { uploadSosReport, SosUploadCancelledError } = uploadModule()
  const content = bytes(CHUNK * 3)
  const controller = new AbortController()
  const client = fakeClient({ size: content.length })
  const post = client.post
  client.post = async (url, body) => {
    if (url.includes('/chunks/') && client.calls.chunks.length === 1) {
      controller.abort()
      throw Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })
    }
    return post(url, body)
  }

  await assert.rejects(
    uploadSosReport(new File([content], 'a.tar.xz'), () => {}, controller.signal, { client, wait: noWait }),
    SosUploadCancelledError,
  )

  assert.equal(client.calls.chunks.length, 1)
  assert.equal(client.calls.completed, 0)
  assert.deepEqual(client.calls.deleted, ['/sos-reports/uploads/u1'])
})

test('cancelling during the retry wait takes effect immediately', async () => {
  const { uploadSosReport, SosUploadCancelledError } = uploadModule()
  const controller = new AbortController()
  const client = fakeClient({ size: 10, failures: { chunk0: [networkError()] } })
  const started = Date.now()

  const upload = uploadSosReport(new File([bytes(10)], 'a.tar.xz'), () => {}, controller.signal, { client })
  setTimeout(() => controller.abort(), 20)

  await assert.rejects(upload, SosUploadCancelledError)
  assert.ok(Date.now() - started < 1500, '不能等完 2 秒的重试间隔')
  assert.deepEqual(client.calls.deleted, ['/sos-reports/uploads/u1'])
})

/** 在假的 window 上运行回调，结束后恢复全局对象。 */
async function withFakeWindow(run) {
  const originals = { window: globalThis.window, document: globalThis.document, now: Date.now }
  let tick = () => {}
  let clock = 1_000_000
  const fakeWindow = Object.assign(new EventTarget(), {
    setInterval: (callback) => { tick = callback; return 1 },
    clearInterval() {},
    location: { href: '' },
  })
  globalThis.window = fakeWindow
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  Date.now = () => clock
  try {
    return await run({
      fakeWindow,
      tick: () => tick(),
      advanceMinutes: (minutes) => { clock += minutes * 60_000 },
    })
  } finally {
    globalThis.window = originals.window
    globalThis.document = originals.document
    Date.now = originals.now
  }
}

function startIdleSession() {
  const touches = []
  const logouts = []
  const { useIdleSession } = load(src('hooks/useIdleSession.ts'), {
    extraMocks: {
      react: { useEffect: (effect) => effect(), useRef: (value) => ({ current: value }) },
      '@/lib/api': { __esModule: true, default: { post: async (url) => { touches.push(url) } } },
      '@/lib/auth': { getToken: () => 'token' },
      '@/lib/auth-broadcast': { subscribeAuthBroadcast: () => () => {} },
      '@/hooks/useAuth': { useAuth: () => ({ logout: (reason) => logouts.push(reason) }) },
    },
  })
  useIdleSession()
  return { touches, logouts }
}

test('without activity the idle timer still logs the user out', () => withFakeWindow(({ tick, advanceMinutes }) => {
  const { logouts } = startIdleSession()
  advanceMinutes(61)
  tick()
  assert.deepEqual(logouts, ['SESSION_TIMEOUT'])
}))

test('an upload that keeps making progress is not interrupted by the idle timeout', () => withFakeWindow(async ({ tick, advanceMinutes }) => {
  const { touches, logouts } = startIdleSession()
  const { uploadSosReport } = uploadModule()
  const content = bytes(CHUNK * 3)
  const client = fakeClient({ size: content.length })
  const post = client.post
  // 每片约 40 分钟，三片共两小时，远超 60 分钟的空闲时限。
  client.post = async (url, body) => {
    if (url.includes('/chunks/')) {
      advanceMinutes(40)
      tick()
    }
    return post(url, body)
  }

  await uploadSosReport(new File([content], 'a.tar.xz'), () => {}, new AbortController().signal, { client, wait: noWait })

  assert.deepEqual(logouts, [])
  assert.deepEqual(touches, ['/auth/session/touch', '/auth/session/touch', '/auth/session/touch'], '后端的空闲时限也要续期')
}))

test('a stalled upload does not keep the session alive', () => withFakeWindow(async ({ tick, advanceMinutes }) => {
  const { touches, logouts } = startIdleSession()
  const { uploadSosReport } = uploadModule()
  const stalled = networkError()
  const client = fakeClient({ size: 10, failures: { chunk0: Array(5).fill(stalled) } })

  await assert.rejects(uploadSosReport(new File([bytes(10)], 'a.tar.xz'), () => {}, new AbortController().signal, {
    client,
    wait: async () => { advanceMinutes(20) },
  }), stalled)
  tick()

  assert.deepEqual(touches, [], '没有确认任何分片，不能续期')
  assert.deepEqual(logouts, ['SESSION_TIMEOUT'])
}))

test('progress label tells the user what is happening', () => {
  const { uploadProgressLabel } = uploadModule()
  const total = 10 * CHUNK
  assert.match(uploadProgressLabel({ phase: 'preparing', percent: 0, uploadedBytes: 0, totalBytes: total }), /校验/)
  const uploading = uploadProgressLabel({ phase: 'uploading', percent: 30, uploadedBytes: 3 * CHUNK, totalBytes: total, remainingSeconds: 480 })
  assert.match(uploading, /已上传 3\.0 MB \/ 10\.0 MB/)
  assert.match(uploading, /约 8 分钟/)
  assert.match(uploading, /请勿刷新或关闭页面/)
  assert.match(uploadProgressLabel({ phase: 'assembling', percent: 100, uploadedBytes: total, totalBytes: total }), /合并/)
})

test('duration format', () => {
  const format = load(src('lib/sos-report-format.ts'))
  assert.equal(format.formatDuration(30), '不到 1 分钟')
  assert.equal(format.formatDuration(660), '约 11 分钟')
  assert.equal(format.formatDuration(13_680), '约 3.8 小时')
})

test('the page uses chunked upload and keeps failures on screen', () => {
  const page = fs.readFileSync(LIST_PAGE, 'utf8')
  assert.match(page, /uploadSosReport\(/)
  assert.doesNotMatch(page, /toast\.error\(getApiErrorMessage\(error, '上传失败'\)\)/)
  assert.match(page, /<Alert tone="danger" title="上传失败"/)
  assert.doesNotMatch(fs.readFileSync(src('lib/sos-report-api.ts'), 'utf8'), /sos-reports\/upload'/)
})

test('api client does not send snake_case fields', () => {
  const client = fs.readFileSync(src('lib/sos-report-api.ts'), 'utf8')
  assert.doesNotMatch(client, /[a-z]_[a-z]+:/)
})
