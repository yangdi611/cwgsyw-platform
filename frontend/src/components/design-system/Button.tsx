import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { LoaderCircle } from 'lucide-react'
export { buttonVariants } from '@/components/ui/button'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'default'
  | 'outline'
  | 'destructive'
  | 'link'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'default' | 'xs' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** V2 names are preferred; legacy names remain during incremental migration. */
  variant?: ButtonVariant
  /** V2 names are preferred; legacy names remain during incremental migration. */
  size?: ButtonSize
  /** Prevents duplicate actions while preserving the button's rendered dimensions. */
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, disabled, loading = false, variant = 'secondary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-1.5 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-v2-primary hover:bg-v2-primary-hover text-white shadow-v2-sm',
      secondary: 'bg-v2-surface border border-v2-border hover:border-v2-border-strong hover:bg-v2-surface-hover text-v2-fg shadow-v2-sm',
      ghost: 'bg-transparent hover:bg-v2-surface-soft text-v2-fg',
      danger: 'bg-v2-danger hover:bg-v2-danger/90 text-white shadow-v2-sm',
      default: 'bg-v2-primary hover:bg-v2-primary-hover text-white shadow-v2-sm',
      outline: 'bg-v2-surface border border-v2-border hover:border-v2-border-strong hover:bg-v2-surface-hover text-v2-fg shadow-v2-sm',
      destructive: 'bg-v2-danger hover:bg-v2-danger/90 text-white shadow-v2-sm',
      link: 'bg-transparent text-v2-primary underline-offset-4 hover:underline',
    }

    const sizes = {
      sm: 'h-9 px-3 text-sm rounded-v2-sm',
      md: 'h-10 px-4 text-sm rounded-v2-md',
      lg: 'h-11 px-6 text-base rounded-v2-md',
      default: 'h-8 px-2.5 text-sm rounded-v2-sm',
      xs: 'h-6 px-2 text-xs rounded-v2-sm',
      icon: 'size-8 p-0 rounded-v2-sm',
      'icon-xs': 'size-6 p-0 rounded-v2-sm',
      'icon-sm': 'size-7 p-0 rounded-v2-sm',
      'icon-lg': 'size-9 p-0 rounded-v2-md',
    }

    return (
      <button
        ref={ref}
        {...props}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        disabled={disabled || loading}
        className={cn(baseStyles, variants[variant], sizes[size], loading && 'relative', className)}
      >
        {loading ? (
          <>
            <span className="inline-flex items-center gap-1.5 opacity-0">
              {children}
            </span>
            <LoaderCircle className="absolute size-4 animate-spin" aria-hidden="true" />
          </>
        ) : children}
      </button>
    )
  },
)

Button.displayName = 'Button'

export { Button }
