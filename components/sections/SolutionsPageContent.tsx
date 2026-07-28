'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, Smartphone, ShoppingCart, Globe, Layers, Database,
  HeartPulse, Briefcase, Wrench, Wifi, Monitor, FlaskConical,
  GraduationCap, ChevronDown, ArrowRight, Sparkles, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
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
  description: string
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
    description: 'We design and build websites, web apps, mobile applications, and custom software tailored to your exact business requirements — using modern, scalable technology stacks.',
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
    description: 'Purpose-built enterprise platforms that manage your core operations — from school administration to hospital management. These are not off-the-shelf products; every module is built around your workflows.',
    color: '#b5915a',
    bgColor: 'rgba(181, 145, 90, 0.08)',
    services: [
      { icon: GraduationCap, label: 'HIVE ERP', tag: 'School Management System' },
      { icon: Monitor, label: 'Vision Digital Boards', tag: 'Schools & Corporates' },
      { icon: HeartPulse, label: 'HMS', tag: 'Hospital Management System' },
      { icon: Briefcase, label: 'Job Hiring Platform', tag: 'Coming Soon' },
    ],
  },
  {
    id: 'hardware',
    icon: Wrench,
    title: 'Hardware & Infrastructure',
    tagline: 'End-to-end physical technology solutions',
    description: 'From network setup to computer lab builds to office infrastructure — we handle the physical side of technology so you don\'t have to coordinate with multiple vendors.',
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

const WHY_US = [
  'Single vendor for software + hardware',
  'On-time delivery, always',
  'Post-launch support included',
  'Transparent pricing — no surprises',
]

export default function SolutionsPageContent() {
  const [openPillar, setOpenPillar] = useState<string | null>('software')

  return (
    <div className="bg-white pt-24">
      {/* Hero banner */}
      <section className="relative py-20 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(181,145,90,0.05) 0%, transparent 70%)',
          }}
        />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-4">
            <span className="bronze-label">What We Offer</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="section-title mb-5 max-w-3xl mx-auto"
          >
            Solutions Built for Real Businesses.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg text-[#666666] max-w-2xl mx-auto leading-relaxed"
          >
            From your first website to a full school management system — we deliver technology that fits how you actually work.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap justify-center gap-3 mt-8"
          >
            {WHY_US.map((item) => (
              <span key={item} className="inline-flex items-center gap-2 glass-card px-4 py-2 text-sm text-[#555555]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#b5915a] flex-shrink-0" />
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pillars */}
      <section className="section-padding border-t border-black/[0.07]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {PILLARS.map((pillar, idx) => {
              const isOpen = openPillar === pillar.id
              return (
                <motion.div
                  key={pillar.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={viewportConfig}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="glass-card overflow-hidden cursor-pointer"
                  onClick={() => setOpenPillar(isOpen ? null : pillar.id)}
                  style={{ background: 'rgba(0,0,0,0.02)' }}
                >
                  <div className="p-7">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: pillar.bgColor }}>
                      <pillar.icon className="w-7 h-7" style={{ color: pillar.color }} />
                    </div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h2 className="text-xl font-bold text-[#0a0a0a] leading-tight">{pillar.title}</h2>
                      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }} className="flex-shrink-0 mt-0.5">
                        <ChevronDown className="w-5 h-5 text-[#777777]" />
                      </motion.div>
                    </div>
                    <p className="text-[#666666] text-sm leading-relaxed mb-4">{pillar.description}</p>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: pillar.bgColor, color: pillar.color }}>
                      {pillar.services.length} services
                    </span>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-7 pb-7 border-t pt-5" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                          <ul className="space-y-3">
                            {pillar.services.map((service) => (
                              <li key={service.label} className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: pillar.bgColor }}>
                                  <service.icon className="w-3.5 h-3.5" style={{ color: pillar.color }} />
                                </div>
                                <div>
                                  <span className="text-[#3a3a3a] text-sm font-medium">{service.label}</span>
                                  {service.tag && (
                                    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/[0.04] text-[#666666]">
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
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportConfig}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-16 text-center glass-card p-10"
            style={{ background: 'rgba(181,145,90,0.04)' }}
          >
            <h3 className="text-2xl font-bold text-[#0a0a0a] mb-3">Ready to get started?</h3>
            <p className="text-[#666666] text-sm mb-6 max-w-md mx-auto">Tell us what you need and we'll come back with a clear plan and honest timeline.</p>
            <Link href="/contact" className="btn-bronze inline-flex items-center gap-2">
              Start a Project
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
