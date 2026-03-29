import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'

export const metadata: Metadata = {
  title: '77STF — System Wewnętrzny',
  description: 'Panel operacyjny 77STF',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pl" className="antialiased h-full">
      <body className={`${GeistSans.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  )
}
