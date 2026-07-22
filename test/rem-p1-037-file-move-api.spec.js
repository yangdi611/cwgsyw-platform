const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = 'REM_P1_037_20260718_022000'

test('fileMoveApiLifecycle', async () => {
  const api = await request.newContext({ baseURL })
  let headers
  let sourceFolderId
  let targetFolderId
  const fileIds = []
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const groups = await api.get('/api/groups', { headers })
    const groupBody = await groups.json()
    const group = (groupBody.data?.records ?? groupBody.data ?? []).find(value => value.name === '管理组')
    expect(group?.id).toBeTruthy()
    const source = await api.post('/api/files/folders', { headers, data: { name: `${runId}_source`, ownerGroupId: group.id } })
    const target = await api.post('/api/files/folders', { headers, data: { name: `${runId}_target`, ownerGroupId: group.id } })
    expect(source.status()).toBe(200)
    expect(target.status()).toBe(200)
    sourceFolderId = (await source.json()).data.id
    targetFolderId = (await target.json()).data.id

    for (const content of ['move', 'conflict']) {
      const upload = await api.post('/api/files/upload', {
        headers,
        multipart: { file: { name: `${runId}_${content}.txt`, mimeType: 'text/plain', buffer: Buffer.from(content) }, folder_id: String(sourceFolderId) },
      })
      expect(upload.status()).toBe(200)
      fileIds.push((await upload.json()).data.id)
    }
    const targetUpload = await api.post('/api/files/upload', {
      headers,
      multipart: { file: { name: `${runId}_conflict.txt`, mimeType: 'text/plain', buffer: Buffer.from('target') }, folder_id: String(targetFolderId) },
    })
    expect(targetUpload.status()).toBe(200)
    fileIds.push((await targetUpload.json()).data.id)

    const moved = await api.put(`/api/files/${fileIds[0]}`, { headers, data: { parentId: targetFolderId } })
    expect(moved.status()).toBe(200)
    expect((await moved.json()).data).toMatchObject({ id: fileIds[0], folderId: targetFolderId })
    const sourceFiles = (await (await api.get(`/api/files?folderId=${sourceFolderId}&page=1&size=20`, { headers })).json()).data.records
    const targetFiles = (await (await api.get(`/api/files?folderId=${targetFolderId}&page=1&size=20`, { headers })).json()).data.records
    expect(sourceFiles.map(file => file.id)).toEqual([fileIds[1]])
    expect(targetFiles.map(file => file.id)).toContain(fileIds[0])

    const conflict = await api.put(`/api/files/${fileIds[1]}`, { headers, data: { parentId: targetFolderId } })
    expect(conflict.status()).toBe(409)
    const sourceAfterConflict = (await (await api.get(`/api/files?folderId=${sourceFolderId}&page=1&size=20`, { headers })).json()).data.records
    expect(sourceAfterConflict.map(file => file.id)).toEqual([fileIds[1]])
  } finally {
    for (const fileId of fileIds.reverse()) expect((await api.delete(`/api/files/${fileId}`, { headers })).status()).toBe(200)
    if (sourceFolderId) expect((await api.delete(`/api/files/folders/${sourceFolderId}`, { headers })).status()).toBe(200)
    if (targetFolderId) expect((await api.delete(`/api/files/folders/${targetFolderId}`, { headers })).status()).toBe(200)
    await api.dispose()
  }
})
