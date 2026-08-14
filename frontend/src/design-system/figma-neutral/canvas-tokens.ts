export const CANVAS_NEUTRAL = {
  0: '#ffffff',
  50: '#f7f7f7',
  100: '#f0f0f0',
  200: '#e5e5e5',
  300: '#d4d4d4',
  400: '#a3a3a3',
  500: '#737373',
  600: '#525252',
  700: '#404040',
  800: '#262626',
  900: '#171717',
  1000: '#000000',
} as const

export const CANVAS_STATUS = {
  successBg: '#ecfdf3',
  success: '#039855',
  successFg: '#027a48',
  warningBg: '#fffaeb',
  warning100: '#fef0c7',
  warning: '#dc6803',
  warningFg: '#93370d',
  dangerBg: '#fef3f2',
  danger100: '#fee4e2',
  danger: '#d92d20',
  dangerFg: '#912018',
  infoBg: '#eff8ff',
  info: '#175cd3',
  infoFg: '#194185',
} as const

export const CANVAS_ZONE_DEFAULT = CANVAS_NEUTRAL[700]
export const CANVAS_SELECTED = CANVAS_NEUTRAL[800]
