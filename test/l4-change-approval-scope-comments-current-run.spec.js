const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID
const suffix = Date.now()
const runId = `${l4RunId || 'missing'}_change011012_${suffix}`
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId || 'missing', 'test-data-manifest.json')

function sync(objects, cleanupFailures = 0) {
  fs.writeFileSync(manifestPath, `${JSON.stringify({ runId: l4RunId, objects, cleanupFailures }, null, 2)}\n`)
}

test('change011012ApprovalScopeAndCommentBoundaries', async () => {
  test.skip(!l4RunId || !process.env.FQA_SUPERADMIN_PASSWORD, 'L4 credentials are required')
  const api = await request.newContext({ baseURL })
  const objects = []
  const cleanupErrors = []
  let adminHeaders
  let groupA
  let groupB
  const users = []
  const docs = []
  const changeNumbers = new Map()
  const archivedFileIds = new Set()
  const assignments = []
  const roles = []
  const templateIds = []

  async function cleanup(label, action) {
    try {
      const response = await action()
      if (response.status() !== 200) cleanupErrors.push(`${label}:${response.status()}`)
    } catch (error) { cleanupErrors.push(`${label}:${error instanceof Error ? error.message : String(error)}`) }
  }

  async function createUser(label, groupId, permissionIds) {
    const username = `fqa_change011012_${label}_${suffix}`
    const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
    const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
    const response = await api.post('/api/users', { headers: adminHeaders, data: {
      username, password: initialPassword, realName: runId, email: `${username}@example.test`, phone: '13800139000', groupId,
    } })
    expect(response.status()).toBe(200)
    const userId = (await response.json()).data.id
    users.push({ userId, username, initialPassword, finalPassword })
    objects.push({ caseId: ['CHANGE-011', 'CHANGE-012'], type: 'user', id: userId, runId })
    const role = await api.post('/api/rbac/roles', { headers: adminHeaders, data: {
      name: `FQA change ${label} ${String(suffix).slice(-8)}`, code: `fc_${label}_${String(suffix).slice(-8)}`, description: runId, permissionIds,
    } })
    expect(role.status(), await role.text()).toBe(200)
    const roleId = (await role.json()).data.id
    roles.push(roleId)
    objects.push({ caseId: ['CHANGE-011', 'CHANGE-012'], type: 'role', id: roleId, runId })
    const assignment = await api.post(`/api/users/${userId}/role-assignments`, { headers: adminHeaders, data: { roleId, scopeType: 'group', scopeId: groupId } })
    expect(assignment.status()).toBe(200)
    const assignmentId = (await (await api.get(`/api/users/${userId}/role-assignments`, { headers: adminHeaders })).json()).data
      .find((row) => row.roleId === roleId).id
    assignments.push({ userId, assignmentId })
    objects.push({ caseId: ['CHANGE-011', 'CHANGE-012'], type: 'role-assignment', id: assignmentId, userId, runId })
    const login = await api.post('/api/auth/login', { data: { username, password: initialPassword } })
    expect(login.status()).toBe(200)
    expect((await api.post('/api/account/setup', {
      headers: { Authorization: `Bearer ${(await login.json()).data.token}` },
      data: { currentPassword: initialPassword, newPassword: finalPassword, confirmPassword: finalPassword, email: `${username}@example.test`, phone: '13800139000' },
    })).status()).toBe(200)
    const active = await api.post('/api/auth/login', { data: { username, password: finalPassword } })
    expect(active.status()).toBe(200)
    return { userId, headers: { Authorization: `Bearer ${(await active.json()).data.token}` } }
  }

  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    adminHeaders = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const groupsData = (await (await api.get('/api/groups?state=active', { headers: adminHeaders })).json()).data
    const groups = Array.isArray(groupsData) ? groupsData : groupsData.records
    const baseGroup = groups.find((group) => !group.isBuiltin && group.groupType === 'business')
    expect(baseGroup).toBeTruthy()
    const permissionRows = (await (await api.get('/api/rbac/permissions', { headers: adminHeaders })).json()).data
    const permission = (code) => permissionRows.find((row) => row.code === code).id
    const createUpdate = [permission('change_doc:create'), permission('change_doc:update'), permission('change_doc:read'), permission('notification:read')]
    const approve = [permission('change_doc:approve'), permission('change_doc:read')]

    const groupResponse = await api.post('/api/groups', { headers: adminHeaders, data: { name: `${runId}_A`, description: runId } })
    expect(groupResponse.status()).toBe(200)
    groupA = (await groupResponse.json()).data
    objects.push({ caseId: ['CHANGE-011', 'CHANGE-012'], type: 'group', id: groupA.id, runId })
    const groupBResponse = await api.post('/api/groups', { headers: adminHeaders, data: { name: `${runId}_B`, description: runId } })
    expect(groupBResponse.status()).toBe(200)
    groupB = (await groupBResponse.json()).data
    objects.push({ caseId: ['CHANGE-012'], type: 'group', id: groupB.id, runId })

    const leader = await createUser('approver', groupA.id, approve)
    expect((await api.put(`/api/groups/${groupA.id}`, { headers: adminHeaders, data: { name: groupA.name, description: groupA.description, leaderId: leader.userId } })).status()).toBe(200)
    const applicantA = await createUser('applicant_a', groupA.id, createUpdate)
    const applicantB = await createUser('applicant_b', groupB.id, createUpdate)
    sync(objects)

    for (const docType of ['application', 'plan']) {
      const templateResponse = await api.post('/api/admin/change-doc-templates', {
        headers: adminHeaders,
        params: { name: `${runId}_${docType}`, description: runId, docType },
      })
      expect(templateResponse.status(), await templateResponse.text()).toBe(200)
      const templateId = (await templateResponse.json()).data.id
      templateIds.push(templateId)
      objects.push({ caseId: ['CHANGE-011', 'CHANGE-012'], type: 'change-template', id: templateId, runId })
    }
    sync(objects)
    async function createPending(applicant, label) {
      const created = await api.post('/api/change-docs', { headers: applicant.headers, data: {
        title: runId, applicationTemplateId: templateIds[0], planTemplateId: templateIds[1], fieldsData: {},
      } })
      expect(created.status()).toBe(200)
      const id = (await created.json()).data.id
      changeNumbers.set(id, (await created.json()).data.changeNo)
      docs.push(id)
      objects.push({ caseId: ['CHANGE-011', 'CHANGE-012'], type: 'change-doc', id, runId })
      sync(objects)
      const submitted = await api.post(`/api/change-docs/${id}/submit`, { headers: applicant.headers })
      expect(submitted.status(), `${label}: ${await submitted.text()}`).toBe(200)
      expect((await submitted.json()).data.status).toBe('pending')
      return id
    }

    const approvedId = await createPending(applicantA, 'approved')
    const longComment = '审批🙂'.repeat(256)
    const approved = await api.post(`/api/change-docs/${approvedId}/approve`, { headers: leader.headers, data: { approved: true, comment: longComment } })
    expect(approved.status(), await approved.text()).toBe(200)
    expect((await approved.json()).data).toMatchObject({ status: 'approved', approverComment: longComment })
    const applicantNotifications = (await (await api.get('/api/notifications?page=1&size=100', { headers: applicantA.headers })).json()).data.records
    expect(applicantNotifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ refType: 'change_doc', refId: approvedId }),
    ]))
    const archived = (await (await api.get('/api/files', { headers: adminHeaders, params: { page: 1, size: 100 } })).json()).data.records
    for (const file of archived.filter((candidate) => candidate.sourceType === 'change_doc' && candidate.sourceId === approvedId)) {
      archivedFileIds.add(file.id)
      objects.push({ caseId: 'CHANGE-011', type: 'shared-file', id: file.id, runId })
    }
    expect((await api.put(`/api/change-docs/${approvedId}`, { headers: applicantA.headers, data: { fieldsData: { remediationRunId: runId, cleanup: true } } })).status()).toBe(200)

    const rejectedId = await createPending(applicantA, 'rejected')
    const rejected = await api.post(`/api/change-docs/${rejectedId}/approve`, { headers: leader.headers, data: { approved: false, comment: '' } })
    expect(rejected.status(), await rejected.text()).toBe(200)
    expect((await rejected.json()).data).toMatchObject({ status: 'rejected', approverComment: '' })

    const crossGroupId = await createPending(applicantB, 'cross_group')
    const denied = await api.post(`/api/change-docs/${crossGroupId}/approve`, { headers: leader.headers, data: { approved: true, comment: runId } })
    expect(denied.status()).toBe(404)
    expect((await (await api.get(`/api/change-docs/${crossGroupId}`, { headers: applicantB.headers })).json()).data.status).toBe('pending')
  } finally {
    if (adminHeaders) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          for (const id of docs) {
            const files = (await (await api.get('/api/files', { headers: adminHeaders, params: { keyword: changeNumbers.get(id), page: 1, size: 20 } })).json()).data.records
            for (const file of files.filter((candidate) => candidate.sourceType === 'change_doc' && candidate.sourceId === id)) archivedFileIds.add(file.id)
          }
        } catch (error) { cleanupErrors.push(`archive-discovery:${error instanceof Error ? error.message : String(error)}`) }
        if (archivedFileIds.size >= 4 || attempt === 9) break
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
    for (const fileId of archivedFileIds) {
      const snapshot = await api.get(`/api/access/shared_file/${fileId}`, { headers: adminHeaders })
      if (snapshot.status() === 200) {
        const access = (await snapshot.json()).data
        await cleanup(`shared-file-owner:${fileId}`, () => api.put(`/api/access/shared_file/${fileId}`, { headers: adminHeaders, data: { ...access, ownerUserId: 1 } }))
      }
      await cleanup(`shared-file:${fileId}`, () => api.delete(`/api/files/${fileId}`, { headers: adminHeaders }))
    }
    for (const id of docs.reverse()) {
      const current = await api.get(`/api/change-docs/${id}`, { headers: adminHeaders })
      if (current.status() === 200 && (await current.json()).data.status === 'approved') {
        await cleanup(`doc-redraft:${id}`, () => api.put(`/api/change-docs/${id}`, { headers: adminHeaders, data: { title: runId, fieldsData: {} } }))
      }
      await cleanup(`doc:${id}`, () => api.delete(`/api/change-docs/${id}/remediation-test`, { headers: adminHeaders, params: { remediationRunId: runId } }))
    }
    for (const templateId of templateIds.reverse()) await cleanup(`template:${templateId}`, () => api.delete(`/api/admin/change-doc-templates/${templateId}`, { headers: adminHeaders }))
    for (const assignment of assignments.reverse()) await cleanup(`assignment:${assignment.assignmentId}`, () => api.delete(`/api/users/${assignment.userId}/role-assignments/${assignment.assignmentId}`, { headers: adminHeaders }))
    if (groupA && adminHeaders) await cleanup(`leader:${groupA.id}`, () => api.put(`/api/groups/${groupA.id}`, { headers: adminHeaders, data: { name: groupA.name, description: groupA.description, leaderId: null } }))
    for (const user of users.reverse()) await cleanup(`user:${user.userId}`, () => api.delete(`/api/users/${user.userId}`, { headers: adminHeaders }))
    for (const roleId of roles.reverse()) await cleanup(`role:${roleId}`, () => api.delete(`/api/rbac/roles/${roleId}`, { headers: adminHeaders }))
    for (const group of [groupB, groupA].filter(Boolean).reverse()) {
      const preflight = await api.get(`/api/groups/${group.id}/lifecycle-preflight?action=archive`, { headers: adminHeaders })
      if (preflight.status() !== 200) cleanupErrors.push(`group-preflight:${group.id}:${preflight.status()}`)
      else {
        const data = (await preflight.json()).data
        const archived = await api.post(`/api/groups/${group.id}/archive`, { headers: adminHeaders, data: {
          reason: `${runId} cleanup`, confirmationName: data.group.name, expectedUpdatedAt: data.group.updatedAt,
        } })
        if (archived.status() !== 200) cleanupErrors.push(`group-archive:${group.id}:${archived.status()}`)
      }
    }
    sync([], cleanupErrors.length)
    await api.dispose()
    expect(cleanupErrors, cleanupErrors.join('; ')).toEqual([])
  }
})
