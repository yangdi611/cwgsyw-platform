import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface CmdbAlertVO {
  id: number
  ciInstanceId: number | null
  ciInstanceName: string | null
  alertName: string
  severity: string
  status: string
  summary: string | null
  description: string | null
  startsAt: string | null
  endsAt: string | null
  acknowledged: boolean
  createdAt: string
}

export function useInstanceAlerts(instanceId: string | undefined) {
  return useQuery<CmdbAlertVO[]>({
    queryKey: ['cmdb-instance-alerts', instanceId],
    queryFn: () => api.get(`/cmdb/alerts/by-instance/${instanceId}`).then(r => r.data.data ?? []),
    enabled: !!instanceId,
  })
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (alertId: number) =>
      api.post(`/cmdb/alerts/${alertId}/acknowledge`).then(r => r.data),
    onSuccess: (_data, _alertId) => {
      // Invalidate all alert queries
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-alerts'] })
    },
  })
}
