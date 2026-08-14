'use client'

import { Suspense } from 'react'
import { WorkItemList } from '@/components/work/WorkItemList'
import '@/design-system/figma-neutral/index.css'
import { LoadingState } from '@/design-system/figma-neutral/components'

export default function WorkPage() {
  return (
    <Suspense fallback={<LoadingState label="正在加载我的工作…" />}>
      <WorkItemList />
    </Suspense>
  )
}
