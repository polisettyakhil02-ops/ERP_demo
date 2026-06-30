'use client'

import { motion } from 'framer-motion'
import {
  Code2,
  Brain,
  Cpu,
  Cloud,
  Shield,
  BarChart3,
  Zap,
  Database,
  Users,
  Settings,
  ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import { containerVariants, fadeUpVariants, cardHover, cardTap, viewportConfig } from '@/lib/motion'

interface Service {
  icon: LucideIcon
  title: string
  description: string
  color: string
  bgColor: string
}

const SERVICES: Service[] = [
  {
    icon: Code2,
    title: 'Enterprise Software',
    description: 'Custom-built, mission-critical software engineered for performance, scalability, and long-term reliability at enterprise scale.',
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.08)',
  },
  {
    icon: Brain,
    title: 'Artificial Intelligence',
    description: 'Production-ready AI systems including NLP, computer vision, predictive analytics, and decision automation for real-world impact.',
    color: '#a78bfa',
    bgColor: 'rgba(167, 139, 250, 0.08)',
  },
  {
    icon: Cpu,
    title: 'Intelligent Automation',
    description: 'End-to-end process automation solutions that eliminate manual overhead, reduce error rates, and accelerate business velocity.',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.08)',
  },
  {
    icon: Cloud,
    title: 'Cloud Infrastructure',
    description: 'Multi-cloud architecture, migration strategies, and managed infrastructure designed for resilience, security, and cost efficiency.',
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.08)',
  },
  {
    icon: Shield,
    title: 'Cyber Security',
    description: 'Comprehensive security posture management, threat detection, penetration testing, and compliance frameworks for regulated industries.',
    color: '#f87171',
    bgColor: 'rgba(248, 113, 113, 0.08)',
  },
  {
    icon: BarChart3,
    title: 'Data Analytics',
    description: 'Enterprise data lakes, BI platforms, and real-time analytics pipelines that convert raw data into actionable business intelligence.',
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.08)',
  },
  {
    icon: Zap,
    title: 'Digital Transformation',
    description: 'Strategic technology modernisation programs that align people, process, and platforms for accelerated digital maturity.',
    color: '#fb923c',
    bgColor: 'rgba(251, 146, 60, 0.08)',
  },
  {
    icon: Database,
    title: 'ERP Development',
    description: 'Bespoke ERP systems and platform implementations tailored to complex operational needs across manufacturing, logistics, and finance.',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.08)',
  },
  {
    icon: Users,
    title: 'CRM Solutions',
    description: 'Intelligent customer relationship platforms that unify sales, marketing, and service operations with rich automation and analytics.',
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.08)',
  },
  {
    icon: Settings,
    title: 'Managed IT Services',
    description: 'Proactive infrastructure monitoring, support, and optimisation — ensuring peak performance and uptime with 24/7 expert coverage.',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.08)',
  },
]

export default function ServicesSection() {
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
          title="Enterprise Solutions Built to Scale"
          subtitle="From intelligent automation to cloud-native architecture — every solution we build is engineered for performance, security, and long-term value."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {SERVICES.map((service) => (
            <motion.div
              key={service.title}
              variants={fadeUpVariants}
              whileHover={cardHover}
              whileTap={cardTap}
              className="glass-card p-6 group cursor-default"
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 flex-shrink-0"
                style={{ background: service.bgColor }}
              >
                <service.icon className="w-5 h-5" style={{ color: service.color }} />
              </div>

              <h3 className="text-white font-semibold text-base mb-2 leading-snug">
                {service.title}
              </h3>
              <p className="text-[#606060] text-sm leading-relaxed mb-5">
                {service.description}
              </p>

              {/* Hover reveal */}
              <div className="flex items-center gap-1.5 text-[#b5915a] text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-0.5">
                Learn more
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
