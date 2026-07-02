/**
 * 多标签页登录状态同步（SPEC 13.5）。任一标签页 logout / idle timeout / 会话被撤销后，
 * 通过 BroadcastChannel 通知其它标签页清 token 并跳登录页。
 */

const CHANNEL_NAME = 'cwgsyw-auth-session'

export type AuthLogoutReason = 'USER_LOGOUT' | 'SESSION_TIMEOUT' | 'SESSION_REVOKED'

export type AuthBroadcastMessage =
  | { type: 'logout'; reason: AuthLogoutReason }
  | { type: 'touch'; lastInteractionAt: number }

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(CHANNEL_NAME)
}

export function broadcastLogout(reason: AuthLogoutReason) {
  const channel = getChannel()
  if (!channel) return
  channel.postMessage({ type: 'logout', reason } satisfies AuthBroadcastMessage)
  channel.close()
}

export function broadcastTouch(lastInteractionAt: number) {
  const channel = getChannel()
  if (!channel) return
  channel.postMessage({ type: 'touch', lastInteractionAt } satisfies AuthBroadcastMessage)
  channel.close()
}

/** 订阅其它标签页的广播消息，返回取消订阅函数。 */
export function subscribeAuthBroadcast(handler: (msg: AuthBroadcastMessage) => void): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {}
  }
  const channel = new BroadcastChannel(CHANNEL_NAME)
  const listener = (event: MessageEvent<AuthBroadcastMessage>) => handler(event.data)
  channel.addEventListener('message', listener)
  return () => {
    channel.removeEventListener('message', listener)
    channel.close()
  }
}
