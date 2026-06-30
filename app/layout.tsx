import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Dominare Tech Group | Engineering Tomorrow',
  description:
    'Dominare Tech Group delivers enterprise software, AI, automation, cloud infrastructure and digital transformation solutions that help organisations innovate faster and scale globally.',
  keywords: [
    'Enterprise Software',
    'Artificial Intelligence',
    'Cloud Infrastructure',
    'Digital Transformation',
    'ERP',
    'CRM',
    'Automation',
    'Cyber Security',
    'Data Analytics',
  ],
  authors: [{ name: 'Dominare Tech Group' }],
  openGraph: {
    title: 'Dominare Tech Group | Engineering Tomorrow',
    description:
      'Building Intelligent Digital Enterprises with enterprise software, AI, cloud, and data solutions.',
    type: 'website',
    siteName: 'Dominare Tech Group',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dominare Tech Group',
    description: 'Engineering Tomorrow. Building Intelligent Digital Enterprises.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-near-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}
