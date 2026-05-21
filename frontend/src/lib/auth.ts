const TOKEN_KEY = 'cwgsyw_token'

export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)
export const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)
