import type { SVGProps } from 'react'

export const ICON_NAMES = [
  'search',
  'check',
  'close',
  'eye',
  'chevron-down',
  'chevron-up',
  'chevron-right',
  'chevron-previous',
  'chevron-next',
  'loader',
  'calendar',
  'trash',
  'user',
  'inbox',
] as const

export type IconName = (typeof ICON_NAMES)[number]

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && (ICON_NAMES as readonly string[]).includes(value)
}
export type IconSize = 'sm' | 'md' | 'lg'

const PATHS: Record<IconName, string> = {
  search:
    'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-2.2A5.8 5.8 0 1 0 11 5.2a5.8 5.8 0 0 0 0 11.6Zm7.4 4.3-3.2-3.2 1.6-1.6 3.2 3.2-1.6 1.6Z',
  check: 'M5 12.2 9.2 16.5 19 6.7l-1.6-1.6-8.2 8.2-2.6-2.6L5 12.2Z',
  close:
    'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z',
  eye: 'M12 6c4.4 0 8.1 2.7 9.7 6.5C20.1 16.3 16.4 19 12 19S3.9 16.3 2.3 12.5C3.9 8.7 7.6 6 12 6Zm0 2.2c-3.1 0-5.8 1.8-7.2 4.3 1.4 2.5 4.1 4.3 7.2 4.3s5.8-1.8 7.2-4.3C17.8 10 15.1 8.2 12 8.2Zm0 1.8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
  'chevron-down': 'M6.4 9 12 14.6 17.6 9 19 10.4 12 17.4 5 10.4 6.4 9Z',
  'chevron-up': 'M6.4 15 12 9.4 17.6 15 19 13.6 12 6.6 5 13.6 6.4 15Z',
  'chevron-right': 'M9 6.4 14.6 12 9 17.6 10.4 19 17.4 12 10.4 5 9 6.4Z',
  'chevron-previous': 'M15 6.4 9.4 12 15 17.6 13.6 19 6.6 12 13.6 5 15 6.4Z',
  'chevron-next': 'M9 6.4 14.6 12 9 17.6 10.4 19 17.4 12 10.4 5 9 6.4Z',
  loader:
    'M12 3.5a8.5 8.5 0 1 1-8.5 8.5H5.8A6.2 6.2 0 1 0 12 5.8V3.5Z',
  calendar:
    'M7 3h2v2h6V3h2v2h3v16H4V5h3V3Zm11 6H6v10h12V9Z',
  trash:
    'M9 4h6l1 2h4v2H4V6h4l1-2Zm1 6h2v8h-2v-8Zm4 0h2v8h-2v-8ZM8 8h8l-1 12H9L8 8Z',
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4 0 8 2 8 4.5V21H4v-2.5C4 16 8 14 12 14Z',
  inbox: 'M4 6h16v12H4V6Zm2 2v5h3l1 2h4l1-2h3V8H6Z',
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: IconSize
  title?: string
}

export function Icon({ name, size = 'md', title, className, ...props }: IconProps) {
  return (
    <span data-icon={name} className={['cwgsyw-icon', `cwgsyw-icon--${size}`, className].filter(Boolean).join(' ')}>
      <svg viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : 'presentation'} {...props}>
        {title ? <title>{title}</title> : null}
        <path fill="currentColor" d={PATHS[name]} />
      </svg>
    </span>
  )
}
