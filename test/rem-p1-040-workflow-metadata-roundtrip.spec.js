const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const suffix = Date.now()
const runId = `REM_P1_040_${suffix}`
const key = `remp1040_${suffix}`
const manifestPath = path.join(__dirname, '..', 'docs', 'plan', 'full-platform-remediation', '05-workflow-change', 'REM-P1-040-workflow-definition-metadata-roundtrip', 'test-data-manifest.json')

function manifest(objects) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId, objects, cleanupFailures: 0 }, null, 2) + '\n')
}

function field(page, text) {
  return page.locator('label', { hasText: text }).locator('..').locator('input')
}

function xml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:flowable="http://flowable.org/bpmn" targetNamespace="${runId}_category">
<bpmn:process id="${key}" name="${runId}" isExecutable="true"><bpmn:documentation>${runId}_description</bpmn:documentation>
<bpmn:startEvent id="Start"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent><bpmn:userTask id="Task"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask><bpmn:endEvent id="End"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="F1" sourceRef="Start" targetRef="Task"/><bpmn:sequenceFlow id="F2" sourceRef="Task" targetRef="End"/></bpmn:process>
<bpmndi:BPMNDiagram id="D"><bpmndi:BPMNPlane id="P" bpmnElement="${key}"><bpmndi:BPMNShape id="S_di" bpmnElement="Start"><dc:Bounds x="180" y="180" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="T_di" bpmnElement="Task"><dc:Bounds x="280" y="158" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="E_di" bpmnElement="End"><dc:Bounds x="450" y="180" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="216" y="198"/><di:waypoint x="280" y="198"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="F2_di" bpmnElement="F2"><di:waypoint x="380" y="198"/><di:waypoint x="450" y="198"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`
}

test('remP1040WorkflowMetadataAndModdleRoundTrip', async ({ page }) => {
  test.setTimeout(90_000)
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let headers
  let definitionId
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const create = await api.post('/api/workflow/definitions', { headers, data: { name: runId, key, category: `${runId}_category`, description: `${runId}_description`, xml: xml() } })
    expect(create.status()).toBe(200)
    definitionId = (await create.json()).data.id
    manifest([{ type: 'workflow-definition', id: definitionId, key, runId }])

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/workflow/design/${key}`)
    await expect(page.locator('[data-element-id="Task"]')).toBeVisible()
    const viewport = page.locator('.djs-container .viewport').first()
    const beforeZoom = await viewport.getAttribute('transform')
    await page.locator('.djs-container').first().hover(); await page.mouse.wheel(0, -500)
    await expect.poll(() => viewport.getAttribute('transform')).not.toBe(beforeZoom)
    await page.locator('[data-element-id="Task"] .djs-hit').click()
    await field(page, 'Assignee').fill('superadmin')
    await field(page, 'Candidate Groups').fill('role:super_admin')
    await page.locator('[data-element-id="F2"] .djs-hit').dispatchEvent('click')
    await field(page, 'Condition（条件表达式）').fill('${approved == true}')
    await page.locator('#flowName').fill(`${runId}_v2`)
    await page.locator('#category').fill(`${runId}_category_v2`)
    await page.locator('#desc').fill(`${runId}_description_v2`)
    await page.getByRole('button', { name: '保存新版本', exact: true }).click()
    await page.waitForURL(`${baseURL}/workflow/admin`)

    const versions = (await (await api.get(`/api/workflow/definitions/key/${key}/versions`, { headers })).json()).data
    expect(versions).toHaveLength(2)
    const latest = versions.find((definition) => definition.version === 2)
    expect(latest).toMatchObject({ name: `${runId}_v2`, category: `${runId}_category_v2`, key })
    const detail = (await (await api.get(`/api/workflow/definitions/${encodeURIComponent(latest.id)}`, { headers })).json()).data
    expect(detail.description).toBe(`${runId}_description_v2`)
    expect(detail.xml).toContain('superadmin')
    expect(detail.xml).toContain('role:super_admin')
    expect(detail.xml).toContain('${approved == true}')

    await page.goto(`${baseURL}/workflow/design/${key}`)
    await expect(page.locator('#flowName')).toHaveValue(`${runId}_v2`)
    await expect(page.locator('#category')).toHaveValue(`${runId}_category_v2`)
    await expect(page.locator('#desc')).toHaveValue(`${runId}_description_v2`)
    await page.locator('[data-element-id="Task"] .djs-hit').click()
    await expect(field(page, 'Assignee')).toHaveValue('superadmin')
    await expect(field(page, 'Candidate Groups')).toHaveValue('role:super_admin')
    await page.locator('[data-element-id="F2"] .djs-hit').dispatchEvent('click')
    await expect(field(page, 'Condition（条件表达式）')).toHaveValue('${approved == true}')
  } finally {
    if (definitionId && headers) {
      expect((await api.delete(`/api/workflow/definitions/${encodeURIComponent(definitionId)}`, { headers })).status()).toBe(200)
      expect((await (await api.get(`/api/workflow/definitions/key/${key}/versions`, { headers })).json()).data).toEqual([])
    }
    manifest([])
    await api.dispose()
  }
})
