import { redirect } from 'next/navigation'

export default async function OldModelPage({ params }: { params: Promise<{ modelId: string }> }) {
  const { modelId } = await params
  redirect(`/cmdb/admin/models/${modelId}`)
}
