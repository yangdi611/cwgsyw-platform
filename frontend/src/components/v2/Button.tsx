import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-v2-primary hover:bg-v2-primary-hover text-white shadow-v2-sm',
      secondary: 'bg-v2-surface border border-v2-border hover:border-v2-border-strong hover:bg-v2-surface-hover text-v2-fg shadow-v2-sm',
      ghost: 'bg-transparent hover:bg-v2-surface-soft text-v2-fg',
      danger: 'bg-v2-danger hover:bg-red-700 text-white shadow-v2-sm',
    }

    const sizes = {
      sm: 'h-9 px-3 text-sm rounded-v2-sm',
      md: 'h-10 px-4 text-sm rounded-v2-md',
      lg: 'h-11 px-6 text-base rounded-v2-md',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export { Button }
