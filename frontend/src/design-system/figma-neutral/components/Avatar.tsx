import { Icon } from './Icon'

export interface AvatarProps {
  type?: 'initials' | 'icon' | 'image'
  size?: 'sm' | 'md' | 'lg'
  initials?: string
  src?: string
  alt?: string
}

export function Avatar({ type = 'initials', size = 'sm', initials = 'A', src, alt = '' }: AvatarProps) {
  return (
    <span className={['cwgsyw-avatar', `cwgsyw-avatar--${size}`].join(' ')}>
      {type === 'image' && src ? <img src={src} alt={alt} /> : null}
      {type === 'icon' ? <Icon name="user" size={size} /> : null}
      {type === 'initials' ? initials : null}
    </span>
  )
}
