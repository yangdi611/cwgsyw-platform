const { test, expect, request } = require('@playwright/test')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = process.env.REMEDIATION_RUN_ID || 'REM_P1_075_20260722'
const password = process.env.FQA_SUPERADMIN_PASSWORD || ''
const suffix = `${Date.now()}_${process.pid}`
const executionId = `${runId}_${suffix}`.replace(/[^A-Za-z0-9_]/g, '_')
const manifestPath = path.join(__dirname, '..', 'docs', 'plan', 'full-platform-remediation',
  '05-workflow-change', 'REM-P1-075-change-export-approval-table-contract', 'test-data-manifest.json')
const evidenceDir = process.env.REM_P1_075_EVIDENCE_DIR || ''

function writeManifest(objects, cleanupFailures = 0) {
  const temporaryPath = `${manifestPath}.${executionId}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ runId, objects, cleanupFailures }, null, 2)}\n`, { flag: 'wx' })
  fs.renameSync(temporaryPath, manifestPath)
}

async function data(response) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(200)
  return body.data
}

function docxText(filename) {
  return execFileSync('unzip', ['-p', filename, 'word/document.xml'], { encoding: 'utf8' })
    .replace(/<[^>]+>/g, '')
}

function pdfText(filename) {
  const output = `${filename}.txt`
  execFileSync('pdftotext', ['-layout', filename, output])
  const text = fs.readFileSync(output, 'utf8')
  fs.unlinkSync(output)
  return text
}

test('remP1075ChangeExportApprovalAndTemplateTableContract', async ({ page }) => {
  test.skip(!password, 'FQA_SUPERADMIN_PASSWORD is required')
  test.setTimeout(180_000)

  const api = await request.newContext({ baseURL })
  const objects = []
  const cleanupErrors = []
  const temporaryFiles = []
  const archivedFileIds = new Set()
  const consoleErrors = []
  const serverFailures = []
  let headers
  let applicationTemplateId
  let planTemplateId
  let documentId
  let changeNo
  let workflowTemplateInstanceId
  let bindingId
  let noExportRoleId
  let noExportUserId
  let noExportAssignmentId

  page.on('pageerror', error => consoleErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 500) serverFailures.push(`${response.status()} ${response.url()}`)
  })

  function register(type, id) {
    objects.push({ type, id, runId: executionId })
    writeManifest(objects)
  }

  function unregister(type, id) {
    const index = objects.findIndex(object => object.type === type && object.id === id)
    if (index >= 0) objects.splice(index, 1)
    writeManifest(objects, cleanupErrors.length)
  }

  async function createTemplate(docType, fieldKey, label) {
    const template = await data(await api.post('/api/admin/change-doc-templates', {
      headers,
      params: { name: `${executionId}_${docType}`, description: executionId, docType },
    }))
    register('change-template', template.id)
    const fields = [{
      fieldKey,
      label,
      fieldType: 'table',
      sortOrder: 1,
      required: false,
      inForm: true,
      config: {
        tableMode: 'fixedDocxTable',
        maxRows: 10,
        columns: [
          { key: 'name', label: `${docType}_host`, type: 'text' },
          { key: 'enabled', label: `${docType}_enabled`, type: 'checkbox' },
          { key: 'tier', label: `${docType}_tier`, type: 'select', options: [
            { value: 'primary', label: 'Primary label' },
            { value: 'secondary', label: 'Secondary label' },
          ] },
        ],
      },
    }]
    expect((await api.put(`/api/admin/change-doc-templates/${template.id}/fields`, {
      headers, data: { fields },
    })).status()).toBe(200)
    return template.id
  }

  async function uiDownload(buttonName, which, format) {
    const responsePromise = page.waitForResponse(response => response.url().includes(`/api/change-docs/${documentId}/export`)
      && response.url().includes(`format=${format}`) && response.url().includes(`which=${which}`))
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: buttonName, exact: true }).click()
    const [response, download] = await Promise.all([responsePromise, downloadPromise])
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain(format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(download.suggestedFilename()).toBe(`${changeNo}_${which === 'application' ? '申请单' : '方案'}.${format}`)
    const filename = path.join(os.tmpdir(), `${executionId}_${which}.${format}`)
    await download.saveAs(filename)
    temporaryFiles.push(filename)
    return format === 'pdf' ? pdfText(filename) : docxText(filename)
  }

  try {
    writeManifest([])
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password },
    })
    headers = { Authorization: `Bearer ${(await data(login)).token}` }

    applicationTemplateId = await createTemplate('application', 'application_rows', 'application_table')
    planTemplateId = await createTemplate('plan', 'plan_rows', 'plan_table')
    const approvalComment = `${executionId}_approval_comment`
    const markerSuffix = String(Date.now()).slice(-6)
    const applicationFirst = `app1-${markerSuffix}`
    const applicationSecond = `app2-${markerSuffix}`
    const planOnly = `plan-${markerSuffix}`
    const workflowTemplate = await data(await api.post('/api/workflow/templates/instances', {
      headers,
      data: {
        templateCode: 'single_approval',
        name: executionId,
        processKey: `remP1075${Date.now()}`,
        businessType: 'change_doc',
        description: executionId,
        configValues: {
          approverSource: 'specific_user',
          approverUserId: '1',
          taskName: executionId,
          allowReject: 'true',
        },
        bindNow: true,
      },
    }))
    workflowTemplateInstanceId = workflowTemplate.id
    register('workflow-template-instance', workflowTemplateInstanceId)
    const bindings = await data(await api.get('/api/workflow/center/bindings', { headers }))
    const binding = bindings.find(item => item.businessType === 'change_doc'
      && item.templateInstanceId === workflowTemplateInstanceId)
    expect(binding).toMatchObject({ enabled: true })
    bindingId = binding.id
    register('workflow-binding', bindingId)
    const created = await data(await api.post('/api/change-docs', {
      headers,
      data: {
        title: executionId,
        applicationTemplateId,
        planTemplateId,
        fieldsData: {
          remediationRunId: executionId,
          application_rows: [
            { name: applicationFirst, enabled: true, tier: 'primary' },
            { name: applicationSecond, enabled: false, tier: 'secondary' },
          ],
          plan_rows: [{ name: planOnly, enabled: false, tier: 'secondary' }],
        },
      },
    }))
    documentId = created.id
    changeNo = created.changeNo
    register('change-doc', documentId)
    const createdReadback = await data(await api.get(`/api/change-docs/${documentId}`, { headers }))
    expect(createdReadback.fieldsData.application_rows.map(row => row.name))
      .toEqual([applicationFirst, applicationSecond])
    expect(createdReadback.fieldsData.plan_rows.map(row => row.name)).toEqual([planOnly])
    expect((await data(await api.post(`/api/change-docs/${documentId}/submit`, { headers }))).status).toBe('pending')
    const submittedReadback = await data(await api.get(`/api/change-docs/${documentId}`, { headers }))
    expect(submittedReadback.fieldsData.application_rows.map(row => row.name))
      .toEqual([applicationFirst, applicationSecond])
    expect(submittedReadback.fieldsData.plan_rows.map(row => row.name)).toEqual([planOnly])

    await page.goto(baseURL)
    await page.evaluate(() => localStorage.clear())
    await page.context().clearCookies()
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(password)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/workflow/todo`)
    const taskCard = page.getByText(executionId, { exact: true }).first()
      .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " p-4 ")][1]')
    await taskCard.getByRole('button', { name: '审批' }).click()
    await taskCard.getByRole('textbox').fill(approvalComment)
    await taskCard.getByRole('button', { name: '通过' }).click()
    await expect(page.getByText(executionId, { exact: true })).toHaveCount(0)
    const approvedReadback = await data(await api.get(`/api/change-docs/${documentId}`, { headers }))
    expect(approvedReadback.status).toBe('approved')
    expect(approvedReadback.fieldsData.application_rows.map(row => row.name))
      .toEqual([applicationFirst, applicationSecond])
    expect(approvedReadback.fieldsData.plan_rows.map(row => row.name)).toEqual([planOnly])

    const archived = await data(await api.get('/api/files', {
      headers, params: { keyword: changeNo, page: 1, size: 20 },
    }))
    const archiveFiles = archived.records.filter(file => file.sourceType === 'change_doc' && file.sourceId === documentId)
    expect(archiveFiles).toHaveLength(4)
    for (const file of archiveFiles) {
      archivedFileIds.add(file.id)
      register('shared-file', file.id)
    }

    await page.goto(`${baseURL}/change-docs/${documentId}`)
    await expect(page.getByText(changeNo, { exact: true })).toBeVisible()

    const applicationPdf = await uiDownload('导出申请单 PDF', 'application', 'pdf')
    const applicationDocx = await uiDownload('导出申请单 Word', 'application', 'docx')
    const planPdf = await uiDownload('导出方案 PDF', 'plan', 'pdf')
    const planDocx = await uiDownload('导出方案 Word', 'plan', 'docx')

    for (const exported of [applicationPdf, applicationDocx, planPdf, planDocx]) {
      expect(exported).toContain('approved')
      expect(exported).toContain('superadmin')
      expect(exported).toContain(approvalComment)
      expect(exported).toMatch(/2026-07-2[12] [0-2]\d:[0-5]\d/)
    }
    expect(applicationPdf).toContain('application_table')
    expect(applicationPdf).toContain(applicationFirst)
    expect(applicationPdf).toContain(applicationSecond)
    expect(applicationPdf.indexOf(applicationFirst)).toBeLessThan(applicationPdf.indexOf(applicationSecond))
    expect(applicationPdf).toContain('Primary label')
    expect(applicationPdf).not.toContain(planOnly)
    expect(applicationDocx).toContain('application_table')
    expect(applicationDocx).toContain(applicationFirst)
    expect(applicationDocx).not.toContain(planOnly)
    expect(planPdf).toContain('plan_table')
    expect(planPdf).toContain(planOnly)
    expect(planPdf).toContain('Secondary label')
    expect(planPdf).not.toContain(applicationFirst)
    expect(planDocx).toContain('plan_table')
    expect(planDocx).toContain(planOnly)
    expect(planDocx).not.toContain(applicationFirst)

    for (const file of archiveFiles) {
      const response = await api.get(`/api/files/${file.id}/download`, { headers })
      expect(response.status()).toBe(200)
      const extension = file.fileType === 'pdf' ? 'pdf' : 'docx'
      const filename = path.join(os.tmpdir(), `${executionId}_archive_${file.id}.${extension}`)
      fs.writeFileSync(filename, await response.body())
      temporaryFiles.push(filename)
      const text = extension === 'pdf' ? pdfText(filename) : docxText(filename)
      expect(text).toContain('approved')
      expect(text).toContain('superadmin')
      expect(text).toContain(approvalComment)
      if (file.originalName.includes('申请单')) {
        expect(text).toContain(applicationFirst)
        expect(text).not.toContain(planOnly)
      } else {
        expect(text).toContain(planOnly)
        expect(text).not.toContain(applicationFirst)
      }
    }

    const permissions = await data(await api.get('/api/rbac/permissions', { headers }))
    const readPermission = permissions.find(permission => permission.code === 'change_doc:read')
    expect(readPermission).toBeTruthy()
    noExportRoleId = (await data(await api.post('/api/rbac/roles', {
      headers,
      data: {
        name: `REM P1 075 read ${markerSuffix}`,
        code: `rem_p1_075_read_${markerSuffix}`,
        description: executionId,
        permissionIds: [readPermission.id],
      },
    }))).id
    register('role', noExportRoleId)
    const username = `rem_p1_075_read_${markerSuffix}`
    const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
    const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
    noExportUserId = (await data(await api.post('/api/users', {
      headers,
      data: {
        username,
        password: initialPassword,
        realName: executionId,
        email: `${username}@example.test`,
        phone: '13800138000',
        groupId: 2,
      },
    }))).id
    register('user', noExportUserId)
    expect((await api.post(`/api/users/${noExportUserId}/role-assignments`, {
      headers, data: { roleId: noExportRoleId, scopeType: 'tenant' },
    })).status()).toBe(200)
    noExportAssignmentId = (await data(await api.get(`/api/users/${noExportUserId}/role-assignments`, { headers })))
      .find(assignment => assignment.roleId === noExportRoleId).id
    register('role-assignment', noExportAssignmentId)
    const setupToken = (await data(await api.post('/api/auth/login', {
      data: { username, password: initialPassword },
    }))).token
    expect((await api.post('/api/account/setup', {
      headers: { Authorization: `Bearer ${setupToken}` },
      data: {
        currentPassword: initialPassword,
        newPassword: finalPassword,
        confirmPassword: finalPassword,
        email: `${username}@example.test`,
        phone: '13800138000',
      },
    })).status()).toBe(200)
    const noExportToken = (await data(await api.post('/api/auth/login', {
      data: { username, password: finalPassword },
    }))).token
    expect((await api.get(`/api/change-docs/${documentId}`, {
      headers: { Authorization: `Bearer ${noExportToken}` },
    })).status()).toBe(200)
    expect((await api.get(`/api/change-docs/${documentId}/export`, {
      headers: { Authorization: `Bearer ${noExportToken}` },
      params: { format: 'pdf', which: 'application' },
    })).status()).toBe(403)
    await page.goto(baseURL)
    await page.evaluate(() => localStorage.clear())
    await page.context().clearCookies()
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(username)
    await page.locator('#password').fill(finalPassword)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/change-docs/${documentId}`)
    await expect(page.getByRole('button', { name: /导出.*(PDF|Word)/ })).toHaveCount(0)

    expect(consoleErrors).toEqual([])
    expect(serverFailures).toEqual([])
    if (evidenceDir) {
      fs.mkdirSync(evidenceDir, { recursive: true })
      fs.writeFileSync(path.join(evidenceDir, 'result.json'), `${JSON.stringify({
        runId,
        caseId: 'XL-EXPORT-002',
        status: 'PASS',
        browserDownloads: 4,
        archiveFiles: archiveFiles.length,
        templatePartitioning: 'PASS',
        approvalFields: 'PASS',
        persistedRowOrder: 'PASS',
        noExportApiStatus: 403,
        noExportUiButtons: 0,
        consoleErrors,
        serverFailures,
      }, null, 2)}\n`)
    }
  } finally {
    for (const filename of temporaryFiles) {
      if (fs.existsSync(filename)) fs.unlinkSync(filename)
    }
    if (headers) {
      for (const fileId of archivedFileIds) {
        const response = await api.delete(`/api/files/${fileId}`, { headers })
        if (response.status() === 200) unregister('shared-file', fileId)
        else cleanupErrors.push(`shared-file ${fileId}: HTTP ${response.status()}`)
      }
      if (documentId) {
        const redraft = await api.put(`/api/change-docs/${documentId}`, {
          headers,
          data: { title: executionId, fieldsData: { remediationRunId: executionId } },
        })
        if (redraft.status() !== 200) cleanupErrors.push(`change-doc ${documentId} redraft: HTTP ${redraft.status()}`)
        const response = await api.delete(`/api/change-docs/${documentId}/remediation-test`, {
          headers, params: { remediationRunId: executionId },
        })
        if (response.status() === 200) unregister('change-doc', documentId)
        else cleanupErrors.push(`change-doc ${documentId}: HTTP ${response.status()}`)
      }
      for (const templateId of [planTemplateId, applicationTemplateId].filter(Boolean)) {
        const response = await api.delete(`/api/admin/change-doc-templates/${templateId}`, { headers })
        if (response.status() === 200) unregister('change-template', templateId)
        else cleanupErrors.push(`change-template ${templateId}: HTTP ${response.status()}`)
      }
      if (bindingId) {
        const response = await api.delete(`/api/workflow/center/bindings/${bindingId}`, { headers })
        if (response.status() === 200) unregister('workflow-binding', bindingId)
        else cleanupErrors.push(`workflow-binding ${bindingId}: HTTP ${response.status()}`)
      }
      if (workflowTemplateInstanceId) {
        const response = await api.delete(`/api/workflow/templates/instances/${workflowTemplateInstanceId}`, { headers })
        if (response.status() === 200) unregister('workflow-template-instance', workflowTemplateInstanceId)
        else cleanupErrors.push(`workflow-template-instance ${workflowTemplateInstanceId}: HTTP ${response.status()}`)
      }
      if (noExportAssignmentId && noExportUserId) {
        const response = await api.delete(`/api/users/${noExportUserId}/role-assignments/${noExportAssignmentId}`, { headers })
        if (response.status() === 200) unregister('role-assignment', noExportAssignmentId)
        else cleanupErrors.push(`role-assignment ${noExportAssignmentId}: HTTP ${response.status()}`)
      }
      if (noExportUserId) {
        const response = await api.delete(`/api/users/${noExportUserId}`, { headers })
        if (response.status() === 200) unregister('user', noExportUserId)
        else cleanupErrors.push(`user ${noExportUserId}: HTTP ${response.status()}`)
      }
      if (noExportRoleId) {
        const response = await api.delete(`/api/rbac/roles/${noExportRoleId}`, { headers })
        if (response.status() === 200) unregister('role', noExportRoleId)
        else cleanupErrors.push(`role ${noExportRoleId}: HTTP ${response.status()}`)
      }
    }
    writeManifest(objects, cleanupErrors.length)
    await api.dispose()
    expect(cleanupErrors, cleanupErrors.join('; ')).toEqual([])
    expect(objects).toEqual([])
  }
})
