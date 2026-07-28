import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SolutionsPageContent from '@/components/sections/SolutionsPageContent'

export const metadata: Metadata = {
  title: 'Solutions — Dominare Tech Pvt Ltd',
  description: 'Explore our full range of technology solutions — custom software, enterprise ERP, vision digital boards, hardware infrastructure, and more.',
}

export default function SolutionsPage() {
  return (
    <main>
      <Navbar />
      <SolutionsPageContent />
      <Footer />
    </main>
  )
}
