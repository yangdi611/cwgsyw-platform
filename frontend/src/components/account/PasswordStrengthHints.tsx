'use client'

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inspectPassword, describeViolation, type PasswordPolicyViolation } from '@/lib/password-policy'

const ALL_RULES: PasswordPolicyViolation[] = [
  'TOO_SHORT',
  'MISSING_UPPER',
  'MISSING_LOWER',
  'MISSING_DIGIT',
  'MISSING_SPECIAL',
  'INVALID_CHARACTER',
]

/** 密码规则实时提示（SPEC 13.1/18.3）。username 为空时不展示"不含用户名"提示。 */
export function PasswordStrengthHints({ username, password }: { username?: string; password: string }) {
  const violations = inspectPassword(username, password)
  const rules = username ? [...ALL_RULES, 'CONTAINS_USERNAME' as const] : ALL_RULES

  return (
    <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
      {rules.map((rule) => {
        const failed = violations.includes(rule)
        const passed = password.length > 0 && !failed
        return (
          <li
            key={rule}
            className={cn(
              'flex items-center gap-1.5',
              passed ? 'text-v2-success' : failed && password.length > 0 ? 'text-v2-danger' : 'text-v2-muted'
            )}
          >
            {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {describeViolation(rule)}
          </li>
        )
      })}
    </ul>
  )
}
