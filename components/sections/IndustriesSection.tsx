'use client'

import { motion } from 'framer-motion'
import {
  HeartPulse,
  GraduationCap,
  Factory,
  ShoppingBag,
  TrendingUp,
  Landmark,
  Building2,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import { containerVariants, fadeUpVariants, viewportConfig } from '@/lib/motion'

interface Industry {
  icon: LucideIcon
  title: string
  description: string
  count: string
}

const INDUSTRIES: Industry[] = [
  {
    icon: HeartPulse,
    title: 'Healthcare',
    description: 'Digital health platforms, patient management systems, clinical data analytics, and regulatory-compliant infrastructure.',
    count: '12+ clients',
  },
  {
    icon: GraduationCap,
    title: 'Education',
    description: 'EdTech platforms, learning management systems, student analytics, and institutional ERP for universities and schools.',
    count: '8+ clients',
  },
  {
    icon: Factory,
    title: 'Manufacturing',
    description: 'Smart factory solutions, production optimisation, supply chain digitisation, and Industry 4.0 transformation programs.',
    count: '15+ clients',
  },
  {
    icon: ShoppingBag,
    title: 'Retail',
    description: 'Omnichannel commerce platforms, inventory management, POS systems, and customer intelligence solutions.',
    count: '10+ clients',
  },
  {
    icon: TrendingUp,
    title: 'Finance',
    description: 'Fintech solutions, core banking modernisation, regulatory compliance platforms, and financial analytics systems.',
    count: '9+ clients',
  },
  {
    icon: Landmark,
    title: 'Government',
    description: 'e-Governance platforms, citizen service portals, public sector data management, and secure infrastructure.',
    count: '5+ agencies',
  },
  {
    icon: Building2,
    title: 'Real Estate',
    description: 'PropTech platforms, property management systems, smart building solutions, and portfolio analytics.',
    count: '7+ clients',
  },
  {
    icon: Truck,
    title: 'Logistics',
    description: 'Supply chain management, fleet tracking, warehouse automation, and last-mile delivery optimisation platforms.',
    count: '11+ clients',
  },
]

export default function IndustriesSection() {
  return (
    <section id="industries" className="section-padding bg-[#f5f5f5] relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 80% 50%, rgba(181,145,90,0.03) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeader
          label="Industries We Serve"
          title="Sector-Deep Expertise"
          subtitle="We bring specialised domain knowledge to every engagement — understanding that each industry has unique regulatory, operational, and technological requirements."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {INDUSTRIES.map((industry) => (
            <motion.div
              key={industry.title}
              variants={fadeUpVariants}
              className="industry-card glass-card p-6 group cursor-default"
              style={{ background: 'rgba(0,0,0,0.025)' }}
            >
              <div className="w-11 h-11 rounded-xl bg-[#b5915a]/10 flex items-center justify-center mb-4 group-hover:bg-[#b5915a]/15 transition-colors duration-300">
                <industry.icon className="w-5 h-5 text-[#b5915a]" />
              </div>
              <h3 className="text-[#0a0a0a] font-semibold text-base mb-2">{industry.title}</h3>
              <p className="text-[#777777] text-sm leading-relaxed mb-4">{industry.description}</p>
              <span className="text-xs text-[#b5915a]/70 font-medium">{industry.count}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
