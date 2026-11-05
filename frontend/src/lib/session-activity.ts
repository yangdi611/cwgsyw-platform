const LONG_TASK_ACTIVITY = 'cwgsyw:long-task-activity'

/**
 * 用户发起的长任务确实有进展时调用，算作一次活动，不让空闲超时打断它。
 * 只在有进展时调用：卡住或后台轮询都不能续期登录。
 */
export function reportLongTaskActivity(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LONG_TASK_ACTIVITY))
}

export function subscribeLongTaskActivity(listener: () => void): () => void {
  window.addEventListener(LONG_TASK_ACTIVITY, listener)
  return () => window.removeEventListener(LONG_TASK_ACTIVITY, listener)
}
