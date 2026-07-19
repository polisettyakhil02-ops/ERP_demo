'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb,
  FlaskConical,
  Globe,
  ShieldCheck,
  Users,
  Layers,
  CheckCircle2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import { containerVariants, fadeUpVariants, viewportConfig } from '@/lib/motion'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  points: string[]
  stat: string
  statLabel: string
}

const FEATURES: Feature[] = [
  {
    icon: Lightbulb,
    title: 'Innovation First',
    description: 'We operate at the forefront of technology — investing continuously in R&D, emerging frameworks, and breakthrough methodologies that give our clients a first-mover advantage.',
    points: [
      'Dedicated R&D investment in AI and ML',
      'Rapid prototyping and MVP delivery',
      'Technology scouting and evaluation',
      'Innovation lab for emerging use cases',
    ],
    stat: '40+',
    statLabel: 'Patents & Innovations',
  },
  {
    icon: FlaskConical,
    title: 'Research Driven',
    description: 'Every solution we architect is grounded in rigorous research — combining industry analysis, peer-reviewed methodology, and empirical data to inform every technical decision.',
    points: [
      'Evidence-based architecture decisions',
      'Industry benchmarking and best practices',
      'Academic partnerships for AI research',
      'Continuous internal knowledge publishing',
    ],
    stat: '200+',
    statLabel: 'Research Papers Referenced',
  },
  {
    icon: Globe,
    title: 'Global Delivery',
    description: 'Our distributed delivery model ensures seamless project execution across time zones — with dedicated teams, localised expertise, and consistent quality from inception to go-live.',
    points: [
      'Follow-the-sun development model',
      'Regional support centres across 3 continents',
      'Localisation and compliance per market',
      'ISO-certified delivery processes',
    ],
    stat: '18',
    statLabel: 'Countries Served',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    description: 'Security is never an afterthought at Dominare. We embed security by design into every layer of the systems we build — from network architecture to application code to data governance.',
    points: [
      'SOC 2 Type II and ISO 27001 aligned',
      'OWASP secure coding standards',
      'Zero-trust architecture by default',
      'Quarterly security posture reviews',
    ],
    stat: '0',
    statLabel: 'Major Breaches in Our History',
  },
  {
    icon: Users,
    title: 'Experienced Team',
    description: 'Our team brings decades of combined experience across enterprise software, cloud, AI, and digital transformation — with a culture of mentorship, mastery, and continuous learning.',
    points: [
      'Average 12 years of enterprise experience',
      'Certified architects across major platforms',
      'Continuous professional development programs',
      'Cross-functional agile delivery squads',
    ],
    stat: '150+',
    statLabel: 'Certified Engineers',
  },
  {
    icon: Layers,
    title: 'Scalable Architecture',
    description: 'We design systems that grow with your business — leveraging microservices, cloud-native patterns, and modular design principles that eliminate architectural debt from day one.',
    points: [
      'Cloud-native and microservices by default',
      'API-first integration philosophy',
      'Horizontal scalability baked into design',
      'Architecture governance and review boards',
    ],
    stat: '10M+',
    statLabel: 'Users Supported Daily',
  },
]

export default function WhyDominareSection() {
  const [activeFeature, setActiveFeature] = useState(0)
  const [direction, setDirection] = useState(0)

  const handleSelect = (index: number) => {
    setDirection(index > activeFeature ? 1 : -1)
    setActiveFeature(index)
  }

  const active = FEATURES[activeFeature]

  return (
    <section id="why" className="section-padding bg-white relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 50% 60% at 0% 50%, rgba(181,145,90,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeader
          label="Why Dominare"
          title="What Sets Us Apart"
          subtitle="We don't just deliver technology — we deliver outcomes. Here's what makes Dominare the partner of choice for enterprise organisations."
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10">
          {/* Tab list — left */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
            className="lg:col-span-2 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0"
          >
            {FEATURES.map((feature, i) => (
              <motion.button
                key={feature.title}
                variants={fadeUpVariants}
                onClick={() => handleSelect(i)}
                className={`flex items-center gap-3 px-5 py-4 rounded-xl text-left whitespace-nowrap lg:whitespace-normal transition-all duration-300 flex-shrink-0 lg:flex-shrink border ${
                  activeFeature === i
                    ? 'bg-white/5 border-[#b5915a]/40 text-[#0a0a0a]'
                    : 'border-transparent text-[#666666] hover:text-[#555555] hover:bg-white/3'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    activeFeature === i ? 'bg-[#b5915a]/15' : 'bg-white/4'
                  }`}
                >
                  <feature.icon
                    className={`w-4 h-4 transition-colors duration-300 ${
                      activeFeature === i ? 'text-[#b5915a]' : 'text-[#999999]'
                    }`}
                  />
                </div>
                <span className="font-medium text-sm">{feature.title}</span>
                {activeFeature === i && (
                  <div className="ml-auto w-1 h-6 bg-[#b5915a] rounded-full flex-shrink-0 hidden lg:block" />
                )}
              </motion.button>
            ))}
          </motion.div>

          {/* Feature panel — right */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeFeature}
                custom={direction}
                initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="glass-card p-8 lg:p-10 h-full"
              >
                {/* Icon + stat */}
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#b5915a]/10 flex items-center justify-center">
                    <active.icon className="w-7 h-7 text-[#b5915a]" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-[#0a0a0a]">{active.stat}</div>
                    <div className="text-xs text-[#777777] mt-0.5">{active.statLabel}</div>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-[#0a0a0a] mb-3">{active.title}</h3>
                <p className="text-[#666666] leading-relaxed mb-6 text-base">{active.description}</p>

                {/* Points */}
                <div className="space-y-3">
                  {active.points.map((point) => (
                    <div key={point} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#b5915a] flex-shrink-0 mt-0.5" />
                      <span className="text-[#555555] text-sm">{point}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
