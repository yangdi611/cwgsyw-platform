/**
 * V2 Design System — base components
 *
 * Thin wrappers over ui/ primitives with V2 Design Token overrides.
 * APIs are identical to ui/ counterparts; className is merged after v2 tokens
 * (tailwind-merge resolves conflicts, so v2 tokens win by default).
 */

// Base
export { Button } from './Button'
export type { ButtonProps } from './Button'
export { Card, CardHeader, CardTitle, CardDescription, CardContent } from './Card'
export type { CardProps } from './Card'
export { StatusBadge } from './StatusBadge'
export type { StatusBadgeProps } from './StatusBadge'

// Form controls
export { Input } from './Input'
export { Textarea } from './Textarea'
export { Label } from './Label'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectValue,
  SelectTrigger,
} from './Select'
export { Checkbox } from './Checkbox'
export { Switch } from './Switch'
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './Dialog'
