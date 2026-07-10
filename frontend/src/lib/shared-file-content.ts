import api from '@/lib/api'

function filenameFromContentDisposition(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      return fallback
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(value)
  return plain?.[1] ?? fallback
}

export async function fetchSharedFileBlob(
  id: number | string,
  mode: 'download' | 'preview',
  fallbackName: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await api.get<Blob>(`/files/${id}/${mode}`, {
    responseType: 'blob',
  })

  return {
    blob: response.data,
    filename: filenameFromContentDisposition(
      response.headers['content-disposition'],
      fallbackName,
    ),
  }
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadSharedFile(
  id: number | string,
  fallbackName: string,
): Promise<void> {
  const file = await fetchSharedFileBlob(id, 'download', fallbackName)
  saveBlob(file.blob, file.filename)
}
