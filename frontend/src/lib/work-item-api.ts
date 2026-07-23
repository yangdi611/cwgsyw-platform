import api from '@/lib/api'
import type { PageResult } from '@/lib/task-template-api'

export type WorkItemTab = 'execute' | 'approve' | 'initiated' | 'copied' | 'completed'

export interface WorkItem {
  itemType: 'task' | 'approval'
  itemId: string
  taskId: number
  approvalTaskId?: string
  title: string
  subtitle: string
  nodeName?: string
  status: string
  priority: string
  businessDate?: string
  dueAt?: string
  overdue: boolean
  actionRequired: boolean
  href: string
}

export interface WorkItemCounts {
  execute: number
  approve: number
  initiated: number
  copied: number
  completed: number
}

export interface WorkItemFilters {
  tab: WorkItemTab
  keyword?: string
  templateId?: number
  status?: string
  priority?: string
  overdue?: boolean
  groupId?: number
  from?: string
  to?: string
  page: number
  size: number
}

export async function listWorkItems(filters: WorkItemFilters) {
  return api.get('/work-items', { params: filters })
    .then((response) => response.data.data as PageResult<WorkItem>)
}

export async function getWorkItemCounts() {
  return api.get('/work-items/counts').then((response) => response.data.data as WorkItemCounts)
}
