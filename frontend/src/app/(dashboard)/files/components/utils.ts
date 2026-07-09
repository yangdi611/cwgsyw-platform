export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function fileTypeLabel(type: string): string {
  const map: Record<string, string> = {
    pdf: 'PDF',
    docx: 'Word',
    xlsx: 'Excel',
    xls: 'Excel',
    doc: 'Word',
    pptx: 'PPT',
    ppt: 'PPT',
    txt: '文本',
    png: '图片',
    jpg: '图片',
    jpeg: '图片',
    gif: '图片',
    zip: '压缩包',
    rar: '压缩包',
  }
  if (!type) return '未知'
  return map[type.toLowerCase()] ?? type.toUpperCase()
}
