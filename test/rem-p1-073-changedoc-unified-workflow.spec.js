const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || ''
const evidenceDir = process.env.FQA_CHANGE020_EVIDENCE_DIR || ''
const suffix = `${Date.now()}_${process.pid}`
const remediationRunId = `${l4RunId}_change020_${suffix}`.replace(/[^A-Za-z0-9_]/g, '_')
const processKey = `fqaChange${Date.now()}`
const manifestPath = path.join(__dirname, '..', 'docs', 'plan', 'full-platform-remediation',
  '05-workflow-change', 'REM-P1-073-changedoc-unified-workflow', 'test-data-manifest.json')

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  expect(manifest.runId).toBe(l4RunId)
  return manifest
}

function writeManifest(mutator) {
  const manifest = readManifest()
  mutator(manifest)
  const temporaryPath = `${manifestPath}.${suffix}.${Date.now()}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  fs.renameSync(temporaryPath, manifestPath)
}

function registerObject(object) {
  writeManifest((manifest) => manifest.objects.push({ ...object, executionId: suffix, runId: remediationRunId }))
}

function unregisterObject(type, id) {
  writeManifest((manifest) => {
    manifest.objects = manifest.objects.filter((object) => !(
      object.executionId === suffix && object.type === type && object.id === id
    ))
  })
}

async function responseData(response) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(200)
  return body.data
}

function writeResult(result) {
  if (!evidenceDir) return
  fs.mkdirSync(evidenceDir, { recursive: true })
  fs.writeFileSync(path.join(evidenceDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}

test.describe.configure({ mode: 'serial' })

test('CHANGE-020 change document uses unified workflow end to end', async ({ page }) => {
  test.skip(!l4RunId, 'FQA_L4_RUN_ID is required')
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  test.skip(!evidenceDir, 'FQA_CHANGE020_EVIDENCE_DIR is required')
  test.setTimeout(180_000)

  const api = await request.newContext({ baseURL })
  const cleanupErrors = []
  const consoleErrors = []
  const serverFailures = []
  let headers
  let applicationTemplateId
  let planTemplateId
  let documentId
  let workflowTemplateInstanceId
  let bindingId
  let createdDocumentId
  let taskId
  let finalStatus
  let notificationFound = false
  let auditFound = false
  let snapshotCount = 0
  let residue = {}

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) serverFailures.push(`${response.status()} ${response.url()}`)
  })

  const cleanup = async (type, id, operation) => {
    if (!id || !headers) return false
    try {
      const response = await operation()
      if (response.status() !== 200) {
        cleanupErrors.push(`${type} ${id}: HTTP ${response.status()}`)
        return false
      }
      unregisterObject(type, id)
      return true
    } catch (error) {
      cleanupErrors.push(`${type} ${id}: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  try {
    readManifest()
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    headers = { Authorization: `Bearer ${(await responseData(login)).token}` }

    const existingBindings = await responseData(await api.get('/api/workflow/center/bindings', { headers }))
    expect(existingBindings.filter((binding) => binding.businessType === 'change_doc')).toEqual([])

    const workflowTemplate = await responseData(await api.post('/api/workflow/templates/instances', {
      headers,
      data: {
        templateCode: 'single_approval',
        name: remediationRunId,
        processKey,
        businessType: 'change_doc',
        description: remediationRunId,
        configValues: {
          approverSource: 'specific_user',
          approverUserId: '1',
          taskName: remediationRunId,
          allowReject: 'true',
        },
        bindNow: true,
      },
    }))
    workflowTemplateInstanceId = workflowTemplate.id
    registerObject({ caseIds: ['CHANGE-020'], type: 'workflow-template-instance', id: workflowTemplateInstanceId, processKey })

    const bindings = await responseData(await api.get('/api/workflow/center/bindings', { headers }))
    const binding = bindings.find((item) => item.businessType === 'change_doc'
      && item.templateInstanceId === workflowTemplateInstanceId)
    expect(binding).toMatchObject({ enabled: true, processDefinitionId: workflowTemplate.latestProcessDefinitionId })
    bindingId = binding.id
    registerObject({ caseIds: ['CHANGE-020'], type: 'workflow-binding', id: bindingId })

    applicationTemplateId = (await responseData(await api.post('/api/admin/change-doc-templates', {
      headers,
      params: { name: `${remediationRunId}_application`, description: remediationRunId, docType: 'application' },
    }))).id
    registerObject({ caseIds: ['CHANGE-020'], type: 'change-template', id: applicationTemplateId })
    planTemplateId = (await responseData(await api.post('/api/admin/change-doc-templates', {
      headers,
      params: { name: `${remediationRunId}_plan`, description: remediationRunId, docType: 'plan' },
    }))).id
    registerObject({ caseIds: ['CHANGE-020'], type: 'change-template', id: planTemplateId })

    documentId = (await responseData(await api.post('/api/change-docs', {
      headers,
      data: {
        title: remediationRunId,
        applicationTemplateId,
        planTemplateId,
        fieldsData: { remediationRunId },
      },
    }))).id
    createdDocumentId = documentId
    registerObject({ caseIds: ['CHANGE-020'], type: 'change-doc', id: documentId })

    const submitted = await responseData(await api.post(`/api/change-docs/${documentId}/submit`, { headers }))
    expect(submitted.status).toBe('pending')

    const tasks = await responseData(await api.get('/api/workflow/center/tasks/my', { headers }))
    const matchingTask = tasks.find((task) => task.businessType === 'change_doc'
      && String(task.businessId) === String(documentId))
    expect(matchingTask).toMatchObject({
      businessType: 'change_doc',
      businessId: String(documentId),
      businessUrl: `/change-docs/${documentId}`,
    })
    taskId = matchingTask.taskId

    const legacyBypass = await api.post(`/api/change-docs/${documentId}/approve`, {
      headers,
      data: { approved: true, comment: remediationRunId },
    })
    expect(legacyBypass.status()).toBe(409)
    expect((await responseData(await api.get(`/api/change-docs/${documentId}`, { headers }))).status).toBe('pending')

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/workflow/todo`)
    const taskCard = page.getByText(remediationRunId, { exact: true }).first()
      .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " p-4 ")][1]')
    const detailLink = taskCard.getByRole('link', { name: '查看详情' })
    await expect(detailLink).toHaveAttribute('href', `/change-docs/${documentId}`)
    await detailLink.click()
    await expect(page).toHaveURL(`${baseURL}/change-docs/${documentId}`)
    await expect(page.getByRole('heading', { name: remediationRunId, exact: true })).toBeVisible()

    await page.goto(`${baseURL}/workflow/todo`)
    const refreshedCard = page.getByText(remediationRunId, { exact: true }).first()
      .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " p-4 ")][1]')
    await refreshedCard.getByRole('button', { name: '审批' }).click()
    await refreshedCard.getByRole('textbox').fill(`${remediationRunId} reject`)
    await refreshedCard.getByRole('button', { name: '拒绝' }).click()
    await expect(page.getByText(remediationRunId, { exact: true })).toHaveCount(0)

    finalStatus = (await responseData(await api.get(`/api/change-docs/${documentId}`, { headers }))).status
    expect(finalStatus).toBe('rejected')
    const snapshots = await responseData(await api.get(`/api/change-docs/${documentId}/snapshots`, { headers }))
    snapshotCount = snapshots.length
    expect(snapshotCount).toBeGreaterThan(0)
    const notifications = await responseData(await api.get('/api/notifications', {
      headers, params: { page: 1, size: 100 },
    }))
    notificationFound = notifications.records.some((notice) => notice.refType === 'change_doc' && notice.refId === documentId)
    expect(notificationFound).toBe(true)
    const auditPage = await responseData(await api.get('/api/audit-logs', {
      headers, params: { module: 'change_doc', keyword: String(documentId), page: 1, size: 100 },
    }))
    auditFound = auditPage.records.some((record) => record.targetId === documentId && record.action === 'reject')
    expect(auditFound).toBe(true)

    expect(consoleErrors).toEqual([])
    expect(serverFailures).toEqual([])
  } finally {
    if (headers) {
      if (documentId && await cleanup('change-doc', documentId, () => api.delete(`/api/change-docs/${documentId}/remediation-test`, {
        headers, params: { remediationRunId },
      }))) documentId = undefined
      if (planTemplateId && await cleanup('change-template', planTemplateId,
        () => api.delete(`/api/admin/change-doc-templates/${planTemplateId}`, { headers }))) planTemplateId = undefined
      if (applicationTemplateId && await cleanup('change-template', applicationTemplateId,
        () => api.delete(`/api/admin/change-doc-templates/${applicationTemplateId}`, { headers }))) applicationTemplateId = undefined
      if (bindingId && await cleanup('workflow-binding', bindingId,
        () => api.delete(`/api/workflow/center/bindings/${bindingId}`, { headers }))) bindingId = undefined
      if (workflowTemplateInstanceId && await cleanup('workflow-template-instance', workflowTemplateInstanceId,
        () => api.delete(`/api/workflow/templates/instances/${workflowTemplateInstanceId}`, { headers }))) workflowTemplateInstanceId = undefined

      const finalBindings = await responseData(await api.get('/api/workflow/center/bindings', { headers }))
      const finalTasks = await responseData(await api.get('/api/workflow/center/tasks/my', { headers }))
      const finalNotifications = await responseData(await api.get('/api/notifications', {
        headers, params: { page: 1, size: 100 },
      }))
      residue = {
        bindings: finalBindings.filter((item) => item.businessType === 'change_doc').length,
        tasks: finalTasks.filter((item) => String(item.businessId) === String(createdDocumentId)).length,
        notifications: finalNotifications.records.filter((item) => item.refType === 'change_doc'
          && item.refId === createdDocumentId).length,
      }
      expect(residue).toEqual({ bindings: 0, tasks: 0, notifications: 0 })
    }
    const activeManifestObjects = fs.existsSync(manifestPath)
      ? readManifest().objects.filter((object) => object.executionId === suffix)
      : []
    writeResult({
      runId: l4RunId,
      caseId: 'CHANGE-020',
      remediationRunId,
      documentId: createdDocumentId,
      taskId,
      finalStatus,
      snapshotCount,
      notificationFound,
      auditFound,
      consoleErrors,
      serverFailures,
      cleanupErrors,
      residue,
      activeManifestObjects,
    })
    await api.dispose()
    expect(cleanupErrors, cleanupErrors.join('; ')).toEqual([])
    expect(activeManifestObjects).toEqual([])
  }
})
