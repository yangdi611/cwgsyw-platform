const { test, expect, request } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID
const suffix = Date.now()
const executionId = `${l4RunId || 'missing'}_change_terminal_${suffix}_${process.pid}`.replace(/[^A-Za-z0-9_]/g, '_')
const changeNo = `FQA${suffix}`
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId || '', 'test-data-manifest.json')

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  expect(manifest.runId).toBe(l4RunId)
  return manifest
}

function writeManifest(mutator) {
  const manifest = readManifest()
  mutator(manifest)
  const temporaryPath = `${manifestPath}.${executionId}.${Date.now()}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  fs.renameSync(temporaryPath, manifestPath)
}

function registerObject(object) {
  writeManifest((manifest) => manifest.objects.push({ ...object, executionId }))
}

function unregisterObject(type, id) {
  writeManifest((manifest) => {
    manifest.objects = manifest.objects.filter((object) => !(object.executionId === executionId && object.type === type && object.id === id))
  })
}

async function responseData(response) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(200)
  return body.data
}

function childFolder(folders, name) {
  return (folders || []).find((folder) => folder.name === name)
}

test('stChange001004AndChange013TerminalExportIdempotency', async () => {
  test.skip(!l4RunId, 'FQA_L4_RUN_ID is required')
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  test.setTimeout(120_000)

  const api = await request.newContext({ baseURL })
  const cleanupErrors = []
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), `${executionId}-`))
  let headers
  let applicationTemplateId
  let planTemplateId
  let documentId
  let noExportRoleId
  let noExportUserId
  let noExportAssignmentId
  const archivedFileIds = new Set()

  async function exportDoc(status, which, marker) {
    const response = await api.get(`/api/change-docs/${documentId}/export`, {
      headers,
      params: { format: 'docx', which },
    })
    expect(response.status(), `${status}/${which}`).toBe(200)
    expect(response.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const filename = path.join(temporaryDirectory, `${status}_${which}.docx`)
    fs.writeFileSync(filename, await response.body(), { flag: 'wx', mode: 0o600 })
    const xml = execFileSync('unzip', ['-p', filename, 'word/document.xml'], { encoding: 'utf8' })
    expect(xml, `${status}/${which}`).toContain(marker)
    return xml
  }

  async function auditRecords(action) {
    const page = await responseData(await api.get('/api/audit-logs', {
      headers,
      params: { module: 'change_doc', action, keyword: String(documentId), page: 1, size: 100 },
    }))
    return page.records.filter((record) => record.targetId === documentId && record.action === action)
  }

  try {
    readManifest()
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    headers = { Authorization: `Bearer ${(await responseData(login)).token}` }

    const createTemplate = async (docType) => {
      const response = await api.post('/api/admin/change-doc-templates', {
        headers,
        params: { name: `${executionId}_${docType}`, description: executionId, docType },
      })
      const templateId = (await responseData(response)).id
      registerObject({ caseIds: ['ST-CHANGE-001', 'ST-CHANGE-004', 'CHANGE-013'], type: 'change-template', id: templateId, runId: executionId })
      return templateId
    }
    applicationTemplateId = await createTemplate('application')
    planTemplateId = await createTemplate('plan')

    const originalMarker = `${executionId}_original`
    const created = await api.post('/api/change-docs', {
      headers,
      data: {
        changeNo,
        title: originalMarker,
        applicationTemplateId,
        planTemplateId,
        fieldsData: { remediationRunId: executionId, title: originalMarker },
      },
    })
    documentId = (await responseData(created)).id
    registerObject({ caseIds: ['ST-CHANGE-001', 'ST-CHANGE-004', 'CHANGE-013'], type: 'change-doc', id: documentId, runId: executionId })

    await exportDoc('draft', 'application', changeNo)
    await exportDoc('draft', 'plan', changeNo)

    const submitStatuses = await Promise.all([
      api.post(`/api/change-docs/${documentId}/submit`, { headers }),
      api.post(`/api/change-docs/${documentId}/submit`, { headers }),
    ].map(async (promise) => (await promise).status()))
    expect(submitStatuses.sort()).toEqual([200, 409])
    expect((await responseData(await api.get(`/api/change-docs/${documentId}`, { headers }))).status).toBe('pending')
    expect(await auditRecords('submit')).toHaveLength(1)
    await exportDoc('pending', 'application', changeNo)
    await exportDoc('pending', 'plan', changeNo)

    const folderTree = await responseData(await api.get('/api/files/folders', { headers }))
    const archiveRoot = childFolder(folderTree, '变更文档')
    const archiveMonth = childFolder(archiveRoot?.children, new Date().toISOString().slice(0, 7))
    expect(archiveRoot, 'approved cleanup requires the existing formal archive root').toBeTruthy()
    expect(archiveMonth, 'approved cleanup requires the existing formal archive month folder').toBeTruthy()

    const approveStatuses = await Promise.all([
      api.post(`/api/change-docs/${documentId}/approve`, { headers, data: { approved: true, comment: executionId } }),
      api.post(`/api/change-docs/${documentId}/approve`, { headers, data: { approved: true, comment: executionId } }),
    ].map(async (promise) => (await promise).status()))
    expect(approveStatuses.sort()).toEqual([200, 409])
    expect((await responseData(await api.get(`/api/change-docs/${documentId}`, { headers }))).status).toBe('approved')
    expect(await auditRecords('approve')).toHaveLength(1)
    expect(await auditRecords('archive')).toHaveLength(1)
    await exportDoc('approved', 'application', changeNo)
    await exportDoc('approved', 'plan', changeNo)

    const archived = await responseData(await api.get('/api/files', {
      headers,
      params: { keyword: changeNo, page: 1, size: 20 },
    }))
    const archiveFiles = archived.records.filter((file) => file.sourceType === 'change_doc' && file.sourceId === documentId)
    expect(archiveFiles).toHaveLength(4)
    for (const file of archiveFiles) {
      archivedFileIds.add(file.id)
      registerObject({ caseIds: ['ST-CHANGE-001', 'ST-CHANGE-004'], type: 'shared-file', id: file.id, runId: executionId })
    }
    const archivedApplicationWord = archiveFiles.find((file) => file.fileType === 'docx' && file.originalName.includes('申请单'))
    expect(archivedApplicationWord).toBeTruthy()
    const archivedDownload = await api.get(`/api/files/${archivedApplicationWord.id}/download`, { headers })
    expect(archivedDownload.status()).toBe(200)
    const archivedPath = path.join(temporaryDirectory, 'archived.docx')
    fs.writeFileSync(archivedPath, await archivedDownload.body(), { flag: 'wx', mode: 0o600 })
    const archivedXml = execFileSync('unzip', ['-p', archivedPath, 'word/document.xml'], { encoding: 'utf8' })
    expect(archivedXml).toContain(changeNo)

    const revisedMarker = `${executionId}_revised`
    const redrafted = await api.put(`/api/change-docs/${documentId}`, {
      headers,
      data: { title: revisedMarker, fieldsData: { remediationRunId: executionId, title: revisedMarker } },
    })
    expect((await responseData(redrafted)).status).toBe('draft')
    expect(await auditRecords('update')).toHaveLength(1)
    expect(archivedXml).not.toContain(revisedMarker)
    await exportDoc('redraft', 'application', changeNo)
    await exportDoc('redraft', 'plan', changeNo)

    expect((await responseData(await api.post(`/api/change-docs/${documentId}/submit`, { headers }))).status).toBe('pending')
    const rejected = await api.post(`/api/change-docs/${documentId}/approve`, {
      headers,
      data: { approved: false, comment: `${executionId}_reject` },
    })
    expect((await responseData(rejected)).status).toBe('rejected')
    await exportDoc('rejected', 'application', changeNo)
    await exportDoc('rejected', 'plan', changeNo)

    const permissions = await responseData(await api.get('/api/rbac/permissions', { headers }))
    const readPermission = permissions.find((permission) => permission.code === 'change_doc:read')
    expect(readPermission).toBeTruthy()
    noExportRoleId = (await responseData(await api.post('/api/rbac/roles', {
      headers,
      data: {
        name: `FQA Change no export ${suffix}`,
        code: `fqa_change_no_export_${suffix}`,
        description: executionId,
        permissionIds: [readPermission.id],
      },
    }))).id
    registerObject({ caseIds: ['CHANGE-013'], type: 'role', id: noExportRoleId, runId: executionId })

    const username = `fqa_change_no_export_${suffix}`
    const initialPassword = `Fqa!${randomUUID().replaceAll('-', '').slice(0, 8)}A9`
    const finalPassword = `Fqa!${randomUUID().replaceAll('-', '').slice(0, 8)}B8`
    noExportUserId = (await responseData(await api.post('/api/users', {
      headers,
      data: { username, password: initialPassword, realName: executionId, email: `${username}@example.test`, phone: '13800138000', groupId: 2 },
    }))).id
    registerObject({ caseIds: ['CHANGE-013'], type: 'user', id: noExportUserId, runId: executionId })
    expect((await api.post(`/api/users/${noExportUserId}/role-assignments`, {
      headers,
      data: { roleId: noExportRoleId, scopeType: 'tenant' },
    })).status()).toBe(200)
    noExportAssignmentId = (await responseData(await api.get(`/api/users/${noExportUserId}/role-assignments`, { headers })))
      .find((assignment) => assignment.roleId === noExportRoleId).id
    registerObject({ caseIds: ['CHANGE-013'], type: 'role-assignment', id: noExportAssignmentId, userId: noExportUserId, runId: executionId })

    const setupToken = (await responseData(await api.post('/api/auth/login', { data: { username, password: initialPassword } }))).token
    expect((await api.post('/api/account/setup', {
      headers: { Authorization: `Bearer ${setupToken}` },
      data: { currentPassword: initialPassword, newPassword: finalPassword, confirmPassword: finalPassword, email: `${username}@example.test`, phone: '13800138000' },
    })).status()).toBe(200)
    const noExportToken = (await responseData(await api.post('/api/auth/login', { data: { username, password: finalPassword } }))).token
    const noExportHeaders = { Authorization: `Bearer ${noExportToken}` }
    expect((await api.get(`/api/change-docs/${documentId}`, { headers: noExportHeaders })).status()).toBe(200)
    expect((await api.get(`/api/change-docs/${documentId}/export`, {
      headers: noExportHeaders,
      params: { format: 'docx', which: 'application' },
    })).status()).toBe(403)
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
    if (headers) {
      if (documentId) {
        try {
          const discovered = await responseData(await api.get('/api/files', {
            headers,
            params: { keyword: changeNo, page: 1, size: 100 },
          }))
          for (const file of discovered.records.filter((candidate) => candidate.sourceType === 'change_doc' && candidate.sourceId === documentId)) {
            if (!archivedFileIds.has(file.id)) {
              archivedFileIds.add(file.id)
              registerObject({ caseIds: ['ST-CHANGE-001', 'ST-CHANGE-004'], type: 'shared-file', id: file.id, runId: executionId })
            }
          }
        } catch (error) {
          cleanupErrors.push(`archive discovery: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      for (const fileId of archivedFileIds) {
        const response = await api.delete(`/api/files/${fileId}`, { headers })
        if (response.status() === 200) unregisterObject('shared-file', fileId)
        else cleanupErrors.push(`shared-file ${fileId}: HTTP ${response.status()}`)
      }
      if (documentId) {
        const current = await api.get(`/api/change-docs/${documentId}`, { headers })
        if (current.status() === 200 && ['pending', 'approved', 'rejected'].includes((await current.json()).data.status)) {
          const latest = await api.get(`/api/change-docs/${documentId}`, { headers })
          const latestStatus = (await latest.json()).data.status
          if (latestStatus === 'pending') {
            const approved = await api.post(`/api/change-docs/${documentId}/approve`, {
              headers,
              data: { approved: true, comment: executionId },
            })
            if (approved.status() !== 200) cleanupErrors.push(`change-doc ${documentId} approve: HTTP ${approved.status()}`)
          }
          const redraft = await api.put(`/api/change-docs/${documentId}`, {
            headers,
            data: { title: executionId, fieldsData: { remediationRunId: executionId } },
          })
          if (redraft.status() !== 200) cleanupErrors.push(`change-doc ${documentId} redraft: HTTP ${redraft.status()}`)
        }
        const response = await api.delete(`/api/change-docs/${documentId}/remediation-test`, {
          headers,
          params: { remediationRunId: executionId },
        })
        if (response.status() === 200) unregisterObject('change-doc', documentId)
        else cleanupErrors.push(`change-doc ${documentId}: HTTP ${response.status()}`)
      }
      if (noExportAssignmentId && noExportUserId) {
        const response = await api.delete(`/api/users/${noExportUserId}/role-assignments/${noExportAssignmentId}`, { headers })
        if (response.status() === 200) unregisterObject('role-assignment', noExportAssignmentId)
        else cleanupErrors.push(`role-assignment ${noExportAssignmentId}: HTTP ${response.status()}`)
      }
      if (noExportUserId) {
        const response = await api.delete(`/api/users/${noExportUserId}`, { headers })
        if (response.status() === 200) unregisterObject('user', noExportUserId)
        else cleanupErrors.push(`user ${noExportUserId}: HTTP ${response.status()}`)
      }
      if (noExportRoleId) {
        const response = await api.delete(`/api/rbac/roles/${noExportRoleId}`, { headers })
        if (response.status() === 200) unregisterObject('role', noExportRoleId)
        else cleanupErrors.push(`role ${noExportRoleId}: HTTP ${response.status()}`)
      }
      for (const templateId of [planTemplateId, applicationTemplateId].filter(Boolean)) {
        const response = await api.delete(`/api/admin/change-doc-templates/${templateId}`, { headers })
        if (response.status() === 200) unregisterObject('change-template', templateId)
        else cleanupErrors.push(`change-template ${templateId}: HTTP ${response.status()}`)
      }
    }
    if (cleanupErrors.length > 0 && fs.existsSync(manifestPath)) {
      writeManifest((manifest) => { manifest.cleanupFailures = (manifest.cleanupFailures || 0) + cleanupErrors.length })
    }
    await api.dispose()
    expect(cleanupErrors, cleanupErrors.join('; ')).toEqual([])
    expect(readManifest().objects.filter((object) => object.executionId === executionId)).toEqual([])
  }
})
