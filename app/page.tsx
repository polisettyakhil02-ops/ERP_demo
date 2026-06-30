import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/sections/HeroSection'
import AboutSection from '@/components/sections/AboutSection'
import ServicesSection from '@/components/sections/ServicesSection'
import IndustriesSection from '@/components/sections/IndustriesSection'
import WhyDominareSection from '@/components/sections/WhyDominareSection'
import ProductsSection from '@/components/sections/ProductsSection'
import TechStackSection from '@/components/sections/TechStackSection'
import TestimonialsSection from '@/components/sections/TestimonialsSection'
import CareersSection from '@/components/sections/CareersSection'
import ContactSection from '@/components/sections/ContactSection'

export default function Home() {
  return (
    <main>
      <Navbar />
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <IndustriesSection />
      <WhyDominareSection />
      <ProductsSection />
      <TechStackSection />
      <TestimonialsSection />
      <CareersSection />
      <ContactSection />
      <Footer />
    </main>
  )
}
