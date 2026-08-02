const { test, expect, request } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const suffix = Date.now()
const runId = `REM_P1_065_${suffix}`
const key = `remp1065_${suffix}`
const businessType = `rem_p1_065_${suffix}`
const roleCode = `rem_p1_065_reader_${suffix}`
const username = `rem_p1_065_reader_${suffix}`
const initialPassword = `Fqa!${randomUUID().replaceAll('-', '').slice(0, 8)}A9`
const finalPassword = `Fqa!${randomUUID().replaceAll('-', '').slice(0, 8)}B8`
const manifestPath = path.join(__dirname, '..', 'docs', 'plan', 'full-platform-remediation', '05-workflow-change', 'REM-P1-065-workflow-binding-lifecycle', 'test-data-manifest.json')

function writeManifest(objects, cleanupFailures = 0) {
  fs.writeFileSync(manifestPath, `${JSON.stringify({ runId, objects, cleanupFailures }, null, 2)}\n`)
}

function bpmnXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:flowable="http://flowable.org/bpmn" targetNamespace="${runId}">
  <bpmn:process id="${key}" name="${runId}" isExecutable="true">
    <bpmn:startEvent id="Start"><bpmn:outgoing>Flow1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Review" name="${runId}" flowable:assignee="superadmin"><bpmn:incoming>Flow1</bpmn:incoming><bpmn:outgoing>Flow2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End"><bpmn:incoming>Flow2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow1" sourceRef="Start" targetRef="Review"/>
    <bpmn:sequenceFlow id="Flow2" sourceRef="Review" targetRef="End"/>
  </bpmn:process>
</bpmn:definitions>`
}

async function login(api, usernameValue, password) {
  const response = await api.post('/api/auth/login', { data: { username: usernameValue, password } })
  expect(response.status()).toBe(200)
  return { Authorization: `Bearer ${(await response.json()).data.token}` }
}

async function bindings(api, headers) {
  const response = await api.get('/api/workflow/center/bindings', { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).data
}

test('remP1065BindingLifecycleApiUiPermissionAuditAndCleanup', async ({ page }) => {
  test.setTimeout(120_000)
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const objects = []
  const consoleErrors = []
  const serverErrors = []
  let adminHeaders
  let definitionId
  let processInstanceId
  let bindingId
  let roleId
  let userId
  let assignmentId
  let cleanupFailures = 0
  page.on('pageerror', error => consoleErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('response', response => { if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`) })

  try {
    adminHeaders = await login(api, 'superadmin', process.env.FQA_SUPERADMIN_PASSWORD)

    const definitionBody = { name: runId, key, category: runId, description: `${runId}_v1`, xml: bpmnXml() }
    const createdDefinition = await api.post('/api/workflow/definitions', { headers: adminHeaders, data: definitionBody })
    expect(createdDefinition.status(), await createdDefinition.text()).toBe(200)
    const versionOne = (await createdDefinition.json()).data
    definitionId = versionOne.id
    objects.push({ type: 'workflow-definition', id: definitionId, key, runId })
    writeManifest(objects)

    const updatedDefinition = await api.put(`/api/workflow/definitions/${encodeURIComponent(versionOne.id)}`, {
      headers: adminHeaders,
      data: { ...definitionBody, description: `${runId}_v2` },
    })
    expect(updatedDefinition.status(), await updatedDefinition.text()).toBe(200)
    const versionTwo = (await updatedDefinition.json()).data
    expect(versionTwo).toMatchObject({ key, version: 2 })

    const invalidBind = await api.post('/api/workflow/center/bindings', {
      headers: adminHeaders,
      data: { businessType, processDefinitionId: `${key}:999:missing`, remark: runId },
    })
    expect(invalidBind.status()).toBe(400)
    expect((await bindings(api, adminHeaders)).filter(item => item.businessType === businessType)).toEqual([])

    const createdBinding = await api.post('/api/workflow/center/bindings', {
      headers: adminHeaders,
      data: { businessType, processDefinitionId: versionOne.id, remark: runId },
    })
    expect(createdBinding.status(), await createdBinding.text()).toBe(200)
    const binding = (await createdBinding.json()).data
    bindingId = binding.id
    objects.push({ type: 'workflow-binding', id: bindingId, businessType, runId })
    writeManifest(objects)
    expect(binding).toMatchObject({ businessType, processDefinitionId: versionOne.id, processDefinitionVersion: 1, enabled: true })

    const started = await api.post('/api/workflow/instances', {
      headers: adminHeaders,
      data: { processDefinitionId: versionOne.id, businessKey: runId, variables: { runId } },
    })
    expect(started.status(), await started.text()).toBe(200)
    const processInstance = (await started.json()).data
    processInstanceId = processInstance.id
    objects.push({ type: 'workflow-process-instance', id: processInstanceId, definitionId: versionOne.id, runId })
    writeManifest(objects)
    expect(processInstance).toMatchObject({ processDefinitionId: versionOne.id, businessKey: runId, ended: false })

    const permissions = await api.get('/api/rbac/permissions', { headers: adminHeaders })
    expect(permissions.status()).toBe(200)
    const workflowRead = (await permissions.json()).data.find(item => item.code === 'workflow:read')
    expect(workflowRead).toBeTruthy()
    const role = await api.post('/api/rbac/roles', {
      headers: adminHeaders,
      data: { name: runId, code: roleCode, description: runId, permissionIds: [workflowRead.id] },
    })
    expect(role.status()).toBe(200)
    roleId = (await role.json()).data.id
    objects.push({ type: 'role', id: roleId, runId })
    writeManifest(objects)

    const user = await api.post('/api/users', {
      headers: adminHeaders,
      data: { username, password: initialPassword, realName: runId, email: `${username}@example.test`, phone: '13800138000', groupId: 1 },
    })
    expect(user.status()).toBe(200)
    userId = (await user.json()).data.id
    objects.push({ type: 'user', id: userId, runId })
    writeManifest(objects)
    expect((await api.post(`/api/users/${userId}/role-assignments`, {
      headers: adminHeaders,
      data: { roleId, scopeType: 'group', scopeId: 1 },
    })).status()).toBe(200)
    const assignments = await api.get(`/api/users/${userId}/role-assignments`, { headers: adminHeaders })
    assignmentId = (await assignments.json()).data.find(item => item.roleId === roleId).id
    objects.push({ type: 'role-assignment', id: assignmentId, userId, runId })
    writeManifest(objects)
    const setupHeaders = await login(api, username, initialPassword)
    expect((await api.post('/api/account/setup', {
      headers: setupHeaders,
      data: { currentPassword: initialPassword, newPassword: finalPassword, confirmPassword: finalPassword, email: `${username}@example.test`, phone: '13800138000' },
    })).status()).toBe(200)
    const readerHeaders = await login(api, username, finalPassword)
    expect((await api.get('/api/workflow/center/bindings', { headers: readerHeaders })).status()).toBe(403)
    for (const endpoint of [`/api/workflow/center/bindings/${bindingId}/disable`, `/api/workflow/center/bindings/${bindingId}/enable`]) {
      expect((await api.post(endpoint, { headers: readerHeaders })).status()).toBe(403)
    }
    expect((await api.delete(`/api/workflow/center/bindings/${bindingId}`, { headers: readerHeaders })).status()).toBe(403)
    expect((await api.post(`/api/workflow/center/bindings/${bindingId}/disable`)).status()).toBe(403)
    expect((await bindings(api, adminHeaders)).find(item => item.id === bindingId)).toMatchObject({ enabled: true, processDefinitionId: versionOne.id })

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(username)
    await page.locator('#password').fill(finalPassword)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/workflow/bindings`)
    await expect(page).toHaveURL(`${baseURL}/`)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/workflow/bindings`)
    const row = page.locator('.space-y-3 > div').filter({ hasText: businessType }).first()
    await expect(row).toContainText(`${key} v1`)
    await row.getByRole('button', { name: '编辑', exact: true }).click()
    const editDialog = page.getByRole('dialog', { name: '编辑流程绑定' })
    await expect(editDialog).toBeVisible()
    await expect(editDialog.locator('button[role="combobox"]').first()).toBeDisabled()
    await editDialog.locator('button[role="combobox"]').nth(1).click()
    await page.getByRole('option', { name: `${runId} (${key} v2)`, exact: true }).click()
    await editDialog.getByRole('button', { name: '保存', exact: true }).click()
    await expect(row).toContainText(`${key} v2`)
    expect((await bindings(api, adminHeaders)).find(item => item.id === bindingId)).toMatchObject({ processDefinitionId: versionTwo.id, processDefinitionVersion: 2 })

    await row.getByRole('button', { name: '停用', exact: true }).click()
    await expect(row).toContainText('已停用')
    expect((await bindings(api, adminHeaders)).find(item => item.id === bindingId)).toMatchObject({ enabled: false })
    const runningAfterDisable = await api.get('/api/workflow/instances/running', { headers: adminHeaders, params: { key, page: 1, size: 20 } })
    expect((await runningAfterDisable.json()).data.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: processInstanceId, processDefinitionId: versionOne.id, businessKey: runId }),
    ]))
    await api.put(`/api/workflow/definitions/${encodeURIComponent(versionTwo.id)}/suspend`, { headers: adminHeaders })
    const rejectedEnable = await api.post(`/api/workflow/center/bindings/${bindingId}/enable`, { headers: adminHeaders })
    expect(rejectedEnable.status()).toBe(409)
    expect((await bindings(api, adminHeaders)).find(item => item.id === bindingId)).toMatchObject({ enabled: false })
    await api.put(`/api/workflow/definitions/${encodeURIComponent(versionTwo.id)}/activate`, { headers: adminHeaders })
    await row.getByRole('button', { name: '启用', exact: true }).click()
    await expect(row).toContainText('已启用')

    await row.getByRole('button', { name: '删除', exact: true }).click()
    const deleteDialog = page.getByRole('alertdialog')
    await expect(deleteDialog).toContainText(businessType)
    await deleteDialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: '删除', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '确认删除', exact: true }).click()
    await expect(row).toHaveCount(0)
    expect((await bindings(api, adminHeaders)).find(item => item.id === bindingId)).toBeUndefined()
    const runningAfterDelete = await api.get('/api/workflow/instances/running', { headers: adminHeaders, params: { key, page: 1, size: 20 } })
    expect((await runningAfterDelete.json()).data.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: processInstanceId, processDefinitionId: versionOne.id, businessKey: runId }),
    ]))

    const repeatedDelete = await api.delete(`/api/workflow/center/bindings/${bindingId}`, { headers: adminHeaders })
    expect(repeatedDelete.status()).toBe(404)
    const rebound = await api.post('/api/workflow/center/bindings', {
      headers: adminHeaders,
      data: { businessType, processDefinitionId: versionTwo.id, remark: `${runId}_rebind` },
    })
    expect(rebound.status(), await rebound.text()).toBe(200)
    bindingId = (await rebound.json()).data.id
    objects[objects.findIndex(item => item.type === 'workflow-binding')] = { type: 'workflow-binding', id: bindingId, businessType, runId }
    writeManifest(objects)
    expect((await api.delete(`/api/workflow/center/bindings/${bindingId}`, { headers: adminHeaders })).status()).toBe(200)
    bindingId = undefined
    objects.splice(objects.findIndex(item => item.type === 'workflow-binding'), 1)
    writeManifest(objects)

    for (const action of ['bind_process', 'disable_binding', 'enable_binding', 'delete_binding']) {
      const auditResponse = await api.get('/api/audit-logs', { headers: adminHeaders, params: { module: 'workflow', action, keyword: businessType, page: 1, size: 20 } })
      expect(auditResponse.status()).toBe(200)
      expect((await auditResponse.json()).data.records.length, action).toBeGreaterThan(0)
    }
    expect(consoleErrors).toEqual([])
    expect(serverErrors).toEqual([])
  } finally {
    const cleanup = async (operation) => {
      try { await operation() } catch (error) { cleanupFailures += 1; console.error(error) }
    }
    if (bindingId && adminHeaders) await cleanup(async () => expect((await api.delete(`/api/workflow/center/bindings/${bindingId}`, { headers: adminHeaders })).status()).toBe(200))
    if (assignmentId && userId && adminHeaders) await cleanup(async () => expect((await api.delete(`/api/users/${userId}/role-assignments/${assignmentId}`, { headers: adminHeaders })).status()).toBe(200))
    if (userId && adminHeaders) await cleanup(async () => expect((await api.delete(`/api/users/${userId}`, { headers: adminHeaders })).status()).toBe(200))
    if (roleId && adminHeaders) await cleanup(async () => expect((await api.delete(`/api/rbac/roles/${roleId}`, { headers: adminHeaders })).status()).toBe(200))
    if (processInstanceId && adminHeaders) await cleanup(async () => expect((await api.delete(`/api/workflow/instances/${processInstanceId}`, { headers: adminHeaders, params: { reason: runId } })).status()).toBe(200))
    if (definitionId && adminHeaders) await cleanup(async () => expect((await api.delete(`/api/workflow/definitions/${encodeURIComponent(definitionId)}`, { headers: adminHeaders })).status()).toBe(200))
    writeManifest(cleanupFailures === 0 ? [] : objects, cleanupFailures)
    await api.dispose()
  }
})
