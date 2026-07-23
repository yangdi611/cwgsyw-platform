import { Suspense } from 'react'
import { LoadingState } from '@/components/shared'
import { WorkItemList } from '@/components/work/WorkItemList'

export default function WorkPage() {
  return <Suspense fallback={<LoadingState label="正在加载我的工作…" />}><WorkItemList /></Suspense>
}
