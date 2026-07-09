/**
 * Workflow and process definition types
 * Based on Flowable engine and admin API responses
 */

/**
 * Process Definition (workflow template)
 */
export interface ProcessDefinition {
  id: string
  key: string
  name: string
  version: number
  deploymentId: string
  category?: string | null
  description?: string | null
  suspended: boolean
  tenantId?: string
}

/**
 * Process Definition Version (for version history)
 */
export interface ProcessDefinitionVersion {
  id: string
  key: string
  name: string
  version: number
  deploymentId: string
  deploymentTime?: string
  suspended: boolean
}

/**
 * Process Instance (running workflow)
 */
export interface ProcessInstance {
  id: string
  processDefinitionId: string
  processDefinitionKey: string
  processDefinitionName?: string
  businessKey?: string | null
  suspended: boolean
  ended: boolean
  startTime: string
  endTime?: string | null
  startUserId?: string | null
  tenantId?: string
}

/**
 * Task (workflow step)
 */
export interface WorkflowTask {
  id: string
  name: string
  description?: string | null
  processInstanceId: string
  processDefinitionId: string
  assignee?: string | null
  owner?: string | null
  createTime: string
  dueDate?: string | null
  priority?: number
  suspended: boolean
  tenantId?: string
}

/**
 * Admin config item
 */
export interface AdminConfigItem {
  key: string
  value: string
  description?: string
}
