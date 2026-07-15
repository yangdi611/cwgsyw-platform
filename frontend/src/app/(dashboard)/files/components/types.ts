export interface FolderNode {
  id: number
  name: string
  parentId: number | null
  aclCustom?: boolean
  canCreateChild: boolean
  canUpload: boolean
  canDelete: boolean
  canUpdate: boolean
  canManageAcl: boolean
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
  canDelete: boolean
  canManageAcl: boolean
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
