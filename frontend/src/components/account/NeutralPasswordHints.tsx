'use client'

import {
  describeViolation,
  inspectPassword,
  type PasswordPolicyViolation,
} from '@/lib/password-policy'

const BASE_RULES: PasswordPolicyViolation[] = [
  'TOO_SHORT',
  'MISSING_UPPER',
  'MISSING_LOWER',
  'MISSING_DIGIT',
  'MISSING_SPECIAL',
  'INVALID_CHARACTER',
]

export function NeutralPasswordHints({ username, password }: { username?: string; password: string }) {
  const violations = inspectPassword(username, password)
  const rules = username ? [...BASE_RULES, 'CONTAINS_USERNAME' as const] : BASE_RULES

  return (
    <ul className="cwgsyw-password-hints">
      {rules.map((rule) => {
        const failed = violations.includes(rule)
        const passed = password.length > 0 && !failed
        const state = passed ? 'success' : failed && password.length > 0 ? 'danger' : 'neutral'
        return (
          <li key={rule} data-state={state}>
            <span aria-hidden="true">{passed ? '✓' : '×'}</span>
            {describeViolation(rule)}
          </li>
        )
      })}
    </ul>
  )
}
