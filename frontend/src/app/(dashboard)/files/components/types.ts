export interface FolderNode {
  id: number
  name: string
  parentId: number | null
  aclCustom?: boolean
  children?: FolderNode[]
}

export interface SharedFile {
  id: number
  name: string
  originalName: string
  fileType: string
  sizeBytes: number
  folderId: number | null
  createdByName: string
  createdAt: string
}

export interface SharedFileAuditLog {
  id: number
  action: string
  targetType: string
  targetId: number
  operatorName: string
  remark: string
  createdAt: string
}
