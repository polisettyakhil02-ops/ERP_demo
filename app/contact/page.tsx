import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ContactPageContent from '@/components/sections/ContactPageContent'

export const metadata: Metadata = {
  title: 'Contact — Dominare Tech Pvt Ltd',
  description: 'Get in touch with Dominare Tech. We\'re based in Hyderabad, Telangana. Reach us for software development, HIVE ERP, hardware solutions, and more.',
}

export default function ContactPage() {
  return (
    <main>
      <Navbar />
      <ContactPageContent />
      <Footer />
    </main>
  )
}
