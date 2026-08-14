import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '@/design-system/figma-neutral/index.css'
import { NeutralToaster } from '@/design-system/figma-neutral/toast'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IT 运维平台',
  description: 'IT Infrastructure Operations Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <NeutralToaster />
      </body>
    </html>
  )
}
