'use client'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface Group {
  id: number
  name: string
  description: string
}

export default function GroupsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data.data as Group[]),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">组管理</h1>
      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div>
                <span className="font-medium">{group.name}</span>
                {group.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {group.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
