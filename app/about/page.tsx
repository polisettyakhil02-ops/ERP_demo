import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AboutPageContent from '@/components/sections/AboutPageContent'

export const metadata: Metadata = {
  title: 'About — Dominare Tech Pvt Ltd',
  description: 'Learn about Dominare Tech — our mission, vision, values, and the team building tomorrow\'s enterprise technology from Hyderabad, India.',
}

export default function AboutPage() {
  return (
    <main>
      <Navbar />
      <AboutPageContent />
      <Footer />
    </main>
  )
}
