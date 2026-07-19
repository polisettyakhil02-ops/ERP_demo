'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2,
  Smartphone,
  ShoppingCart,
  Globe,
  Layers,
  Database,
  HeartPulse,
  Briefcase,
  Wrench,
  Wifi,
  Monitor,
  FlaskConical,
  GraduationCap,
  ChevronDown,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import SectionHeader from '@/components/ui/SectionHeader'
import { containerVariants, fadeUpVariants, viewportConfig } from '@/lib/motion'

interface Service {
  icon: typeof Code2
  label: string
  tag?: string
}

interface Pillar {
  id: string
  icon: typeof Code2
  title: string
  tagline: string
  color: string
  bgColor: string
  services: Service[]
}

const PILLARS: Pillar[] = [
  {
    id: 'software',
    icon: Code2,
    title: 'Software Development',
    tagline: 'Custom digital products built with modern stacks',
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.08)',
    services: [
      { icon: Globe, label: 'Website Development' },
      { icon: Layers, label: 'Web Application Development' },
      { icon: Smartphone, label: 'Android Application', tag: 'Play Store + White Label' },
      { icon: ShoppingCart, label: 'E-commerce Stores' },
      { icon: ShoppingCart, label: 'Shopify Stores' },
      { icon: Code2, label: 'Custom Software', tag: 'MERN / MEVN Stack' },
    ],
  },
  {
    id: 'enterprise',
    icon: Database,
    title: 'Enterprise Solutions',
    tagline: 'Purpose-built platforms for complex operations',
    color: '#b5915a',
    bgColor: 'rgba(181, 145, 90, 0.08)',
    services: [
      { icon: GraduationCap, label: 'HIVE ERP', tag: 'School Management System' },
      { icon: HeartPulse, label: 'HMS', tag: 'Hospital Management System' },
      { icon: Briefcase, label: 'Job Hiring Platform', tag: 'Coming Soon' },
    ],
  },
  {
    id: 'hardware',
    icon: Wrench,
    title: 'Hardware & Infrastructure',
    tagline: 'End-to-end physical technology solutions',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.08)',
    services: [
      { icon: Wrench, label: 'Hardware Maintenance' },
      { icon: Wifi, label: 'Network Setup & Configuration' },
      { icon: FlaskConical, label: 'Hardware Procurement' },
      { icon: Briefcase, label: 'Office Setup Solutions' },
      { icon: Monitor, label: 'Digital Panels', tag: 'Corporate & Schools' },
      { icon: GraduationCap, label: 'Computer Lab Setup', tag: 'Schools & Colleges' },
    ],
  },
]

export default function ServicesSection() {
  const [activePillar, setActivePillar] = useState<string | null>(null)

  return (
    <section id="services" className="section-padding bg-[#0a0a0a] relative">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(181,145,90,0.03) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeader
          label="What We Do"
          title="Three Pillars of Excellence"
          subtitle="From custom software to enterprise systems to physical infrastructure — we deliver end-to-end technology solutions under one roof."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {PILLARS.map((pillar) => {
            const isOpen = activePillar === pillar.id
            return (
              <motion.div
                key={pillar.id}
                variants={fadeUpVariants}
                className="glass-card overflow-hidden cursor-pointer group"
                onClick={() => setActivePillar(isOpen ? null : pillar.id)}
                style={{ background: 'rgba(255,255,255,0.025)' }}
              >
                {/* Pillar header */}
                <div className="p-7">
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: pillar.bgColor }}
                  >
                    <pillar.icon className="w-7 h-7" style={{ color: pillar.color }} />
                  </div>

                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white leading-tight">{pillar.title}</h3>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      <ChevronDown className="w-5 h-5 text-[#505050]" />
                    </motion.div>
                  </div>
                  <p className="text-[#606060] text-sm leading-relaxed">{pillar.tagline}</p>

                  {/* Service count pill */}
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: pillar.bgColor, color: pillar.color }}
                    >
                      {pillar.services.length} services
                    </span>
                    <span className="text-[#404040] text-xs">Click to expand</span>
                  </div>
                </div>

                {/* Expandable services list */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-7 pb-7 border-t pt-5"
                        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                      >
                        <ul className="space-y-3">
                          {pillar.services.map((service) => (
                            <li key={service.label} className="flex items-start gap-3">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{ background: pillar.bgColor }}
                              >
                                <service.icon className="w-3.5 h-3.5" style={{ color: pillar.color }} />
                              </div>
                              <div>
                                <span className="text-[#c0c0c0] text-sm font-medium">{service.label}</span>
                                {service.tag && (
                                  <span
                                    className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                      service.tag === 'Coming Soon'
                                        ? 'bg-white/5 text-[#505050]'
                                        : 'text-[#606060] bg-white/4'
                                    }`}
                                  >
                                    {service.tag}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>

                        {pillar.id === 'enterprise' && (
                          <Link
                            href="/hive-erp"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-5 flex items-center gap-1.5 text-[#b5915a] text-sm font-semibold hover:gap-2.5 transition-all duration-200"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Explore HIVE ERP
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportConfig}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-[#505050] text-sm mb-4">Have a project in mind? Let&rsquo;s discuss it.</p>
          <Link href="/contact" className="btn-bronze inline-flex items-center gap-2">
            Start a Project
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
