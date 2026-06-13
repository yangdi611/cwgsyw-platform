import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface CmdbAlertVO {
  id: string
  alertName: string
  severity: 'critical' | 'warning' | 'info' | string
  status: 'firing' | 'resolved' | string
  summary?: string
  startsAt?: string
  acknowledged: boolean
}

/**
 * Fetch alerts for a specific CMDB instance.
 * Returns empty array if the alerts endpoint is not yet available.
 */
export function useInstanceAlerts(instanceId: string | undefined) {
  return useQuery<CmdbAlertVO[]>({
    queryKey: ['cmdb-alerts', instanceId],
    queryFn: async () => {
      try {
        const res = await api.get(`/cmdb/instances/${instanceId}/alerts`)
        return res.data
      } catch {
        return []
      }
    },
    enabled: !!instanceId,
    staleTime: 30_000,
  })
}

/**
 * Acknowledge an alert.
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await api.put(`/cmdb/alerts/${alertId}/acknowledge`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cmdb-alerts'] })
    },
  })
}
