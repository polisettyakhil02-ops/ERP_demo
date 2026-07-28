import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/sections/HeroSection'
import WhyDominareSection from '@/components/sections/WhyDominareSection'
import TechStackSection from '@/components/sections/TechStackSection'
import TestimonialsSection from '@/components/sections/TestimonialsSection'
import CareersSection from '@/components/sections/CareersSection'
import ContactSection from '@/components/sections/ContactSection'

export default function Home() {
  return (
    <main>
      <Navbar />
      <HeroSection />
      <WhyDominareSection />
      <TechStackSection />
      <TestimonialsSection />
      <CareersSection />
      <ContactSection />
      <Footer />
    </main>
  )
}
