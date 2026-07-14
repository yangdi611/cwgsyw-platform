import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useAuthorizationEnforced(module: 'wiki' | 'shared_file') {
  const { data } = useQuery<{ state: 'legacy' | 'shadow' | 'enforced'; useUnifiedEditor: boolean }>({
    queryKey: ['authorization-mode', module],
    queryFn: () => api.get(`/access/mode/${module}`).then((response) => response.data.data),
  })
  return data?.useUnifiedEditor ?? false
}
