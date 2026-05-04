import type { Metadata } from 'next'
import { Inter, Lexend } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-lexend',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'SocraticTrig',
  description:
    'A Socratic trigonometry tutor — guides you to the answer step-by-step instead of giving it away.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${lexend.variable}`}>
      <body className="bg-background text-on-background antialiased">
        {children}
      </body>
    </html>
  )
}
