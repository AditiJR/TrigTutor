import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trig Tutor',
  description:
    'A Socratic trigonometry tutor — guides you to the answer step-by-step instead of giving it away.'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
      </body>
    </html>
  )
}
