import api from '@/lib/api'
import type { PageResult, TaskTemplateSummary } from '@/lib/task-template-api'

export type TaskPlanStatus = 'draft' | 'active' | 'paused' | 'finished' | 'archived'
export type ScheduleType = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'cron' | 'holiday_relative'
export type GenerationMode = 'per_user' | 'per_group' | 'shared' | 'single'
export type CiScopeLevel = 'model_group' | 'model' | 'instance'

export interface CiScopeSelection {
  level: CiScopeLevel
  key: string
  label?: string
}

export interface ResolvedCiInstance {
  id: number
  name: string
  modelCode: string
  modelName: string
  modelGroupCode?: string
  modelGroupName?: string
  status?: string
  owner?: string
}

export interface CiScopeResolution {
  selections: CiScopeSelection[]
  total: number
  truncated: boolean
  instances: ResolvedCiInstance[]
  warnings: string[]
}

export interface TaskPlanPayload {
  name: string
  description?: string
  templateVersionId: number
  approvalSchemeVersionId?: number
  scheduleType: ScheduleType
  scheduleConfig: Record<string, unknown>
  generationMode: GenerationMode
  assignmentRule: Record<string, unknown>
  ciScopeConfig?: {
    selections: CiScopeSelection[]
    filters?: Record<string, unknown>
  }
  reminderConfig?: Record<string, unknown>
  escalationConfig?: Record<string, unknown>
  generateAheadDays?: number
  startDate?: string
  endDate?: string
}

export interface TaskPlanSummary {
  id: number
  name: string
  description?: string
  templateVersionId: number
  templateName?: string
  scheduleType: ScheduleType
  generationMode: GenerationMode
  status: TaskPlanStatus
  nextGenerateAt?: string
  lastGeneratedAt?: string
  createdAt: string
  updatedAt: string
}

export interface TaskPlanDetail extends TaskPlanPayload {
  id: number
  templateName?: string
  status: TaskPlanStatus
  nextGenerateAt?: string
  lastGeneratedAt?: string
  lockVersion: number
  createdAt: string
  updatedAt: string
}

export interface AssignmentTarget {
  subjectType: 'user' | 'group' | 'shared'
  subjectId?: number
  assigneeId?: number
  groupId?: number
  displayName: string
  organizationSnapshot: Record<string, unknown>
}

export interface TaskPlanOccurrencePreview {
  occurrenceAt: string
  dueAt: string
  taskCount: number
  targets: AssignmentTarget[]
  ciCount: number
  warnings: string[]
}

export interface TaskPlanPreview {
  templateName: string
  occurrences: TaskPlanOccurrencePreview[]
  totalTaskCount: number
  warnings: string[]
}

export interface DirectoryUser {
  id: number
  username: string
  realName?: string
  groupId?: number
}

export interface DirectoryGroup {
  id: number
  code: string
  name: string
  leaderId?: number
}

export interface ModelGroup {
  id: number
  code: string
  name: string
  modelCount: number
}

export interface CiModel {
  id: number
  modelId: string
  name: string
  displayName?: string
  group?: string
  instanceCount?: number
}

export async function listTaskPlans(params: { keyword?: string; status?: string; page?: number; size?: number }) {
  return api.get('/task-plans', { params }).then((response) => response.data.data as PageResult<TaskPlanSummary>)
}

export async function getTaskPlan(planId: number) {
  return api.get(`/task-plans/${planId}`).then((response) => response.data.data as TaskPlanDetail)
}

export async function createTaskPlan(payload: TaskPlanPayload) {
  return api.post('/task-plans', payload).then((response) => response.data.data as TaskPlanDetail)
}

export async function updateTaskPlan(planId: number, payload: TaskPlanPayload) {
  return api.put(`/task-plans/${planId}`, payload).then((response) => response.data.data as TaskPlanDetail)
}

export async function deleteTaskPlan(planId: number) {
  return api.delete(`/task-plans/${planId}`)
}

export async function previewTaskPlan(payload: TaskPlanPayload, previewCount = 5) {
  return api.post('/task-plans/preview', { ...payload, previewCount })
    .then((response) => response.data.data as TaskPlanPreview)
}

export async function changeTaskPlanStatus(planId: number, action: 'activate' | 'pause' | 'archive') {
  return api.post(`/task-plans/${planId}/${action}`).then((response) => response.data.data as TaskPlanDetail)
}

export async function resolveCiScope(selections: CiScopeSelection[], filters: Record<string, unknown> = {}, limit = 100) {
  return api.post('/cmdb/scopes/preview', { selections, filters, limit })
    .then((response) => response.data.data as CiScopeResolution)
}

export async function listPublishedTemplates() {
  return api.get('/task-templates', { params: { status: 'published', size: 200 } })
    .then((response) => response.data.data.records as TaskTemplateSummary[])
}

export async function listDirectoryUsers() {
  return api.get('/users', { params: { page: 1, size: 200 } })
    .then((response) => (response.data.data.records ?? response.data.data) as DirectoryUser[])
}

export async function listDirectoryGroups() {
  return api.get('/groups').then((response) => response.data.data as DirectoryGroup[])
}

export async function listModelGroups() {
  return api.get('/cmdb/model-groups').then((response) => response.data.data as ModelGroup[])
}

export async function listModels(group?: string) {
  return api.get('/cmdb/models', { params: { group, page: 1, size: 200 } })
    .then((response) => response.data.data.records as CiModel[])
}

export async function listInstances(model: string, keyword?: string) {
  return api.get('/cmdb/instances', { params: { model, keyword, page: 1, size: 200 } })
    .then((response) => response.data.data.records as ResolvedCiInstance[])
}
