import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/sections/HeroSection'
import ServicesSection from '@/components/sections/ServicesSection'
import ClientsSection from '@/components/sections/ClientsSection'
import IndustriesSection from '@/components/sections/IndustriesSection'
import WhyDominareSection from '@/components/sections/WhyDominareSection'
import TechStackSection from '@/components/sections/TechStackSection'
import CareersSection from '@/components/sections/CareersSection'

export default function Home() {
  return (
    <main>
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <ClientsSection />
      <IndustriesSection />
      <WhyDominareSection />
      <TechStackSection />
      <CareersSection />
      <Footer />
    </main>
  )
}
