'use client'

import { motion } from 'framer-motion'
import {
  Database,
  Users,
  Bot,
  UserCog,
  BarChart2,
  GitBranch,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import { containerVariants, fadeUpVariants, cardHover, cardTap, viewportConfig } from '@/lib/motion'

interface Product {
  icon: LucideIcon
  name: string
  tagline: string
  description: string
  features: string[]
  color: string
  bgColor: string
}

const PRODUCTS: Product[] = [
  {
    icon: Database,
    name: 'ERP Platform',
    tagline: 'Enterprise Resource Planning',
    description: 'A fully integrated, modular ERP system built for complex multi-entity operations with real-time visibility across finance, operations, and supply chain.',
    features: [
      'Multi-entity and multi-currency support',
      'Real-time financial reporting and dashboards',
      'Module-based architecture for flexibility',
      'Open API for third-party integration',
    ],
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.08)',
  },
  {
    icon: Users,
    name: 'CRM Suite',
    tagline: 'Customer Relationship Management',
    description: 'An intelligent CRM platform that gives your teams a 360° customer view and the automation tools to close deals faster and retain clients longer.',
    features: [
      '360° unified customer profiles',
      'AI-powered sales pipeline insights',
      'Automated email and campaign workflows',
      'Advanced analytics and forecasting',
    ],
    color: '#a78bfa',
    bgColor: 'rgba(167, 139, 250, 0.08)',
  },
  {
    icon: Bot,
    name: 'AI Assistants',
    tagline: 'Intelligent Workplace Agents',
    description: 'Conversational AI agents trained on your business data — handling queries, automating workflows, and surfacing insights across your organisation.',
    features: [
      'Custom NLP and domain fine-tuning',
      'Multi-channel deployment (web, Slack, Teams)',
      'Workflow orchestration and automation',
      'Audit logs and governance controls',
    ],
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.08)',
  },
  {
    icon: UserCog,
    name: 'HRMS',
    tagline: 'Human Resource Management',
    description: 'A comprehensive HR platform covering the entire employee lifecycle — from onboarding to payroll, performance management, and offboarding.',
    features: [
      'Automated payroll engine with compliance',
      'Leave, attendance, and shift management',
      'Continuous performance review framework',
      'Employee self-service portal',
    ],
    color: '#fb923c',
    bgColor: 'rgba(251, 146, 60, 0.08)',
  },
  {
    icon: BarChart2,
    name: 'Analytics Dashboard',
    tagline: 'Business Intelligence Platform',
    description: 'Enterprise-grade BI that connects to every data source in your stack — delivering live dashboards, predictive models, and boardroom-ready reports.',
    features: [
      'Live data streaming from 50+ connectors',
      'Drag-and-drop custom dashboard builder',
      'Predictive analytics and trend modelling',
      'Scheduled reports and export suite',
    ],
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.08)',
  },
  {
    icon: GitBranch,
    name: 'Workflow Automation',
    tagline: 'Process Orchestration Engine',
    description: 'A visual, no-code workflow builder that lets your teams automate complex business processes without engineering dependencies.',
    features: [
      'Visual drag-and-drop process builder',
      'Trigger, condition, and action logic',
      'Cross-system integration hub',
      'Full audit trail and version control',
    ],
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.08)',
  },
]

export default function ProductsSection() {
  return (
    <section id="products" className="section-padding bg-[#f5f5f5] relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(181,145,90,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeader
          label="Our Products"
          title="Purpose-Built Enterprise Platforms"
          subtitle="Six integrated products designed to work together or independently — giving you the flexibility to adopt what you need, when you need it."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {PRODUCTS.map((product) => (
            <motion.div
              key={product.name}
              variants={fadeUpVariants}
              whileHover={cardHover}
              whileTap={cardTap}
              className="glass-card p-7 group cursor-default flex flex-col"
              style={{ background: 'rgba(0,0,0,0.025)' }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0"
                style={{ background: product.bgColor }}
              >
                <product.icon className="w-7 h-7" style={{ color: product.color }} />
              </div>

              {/* Name + tagline */}
              <h3 className="text-xl font-bold text-[#0a0a0a] mb-0.5">{product.name}</h3>
              <p className="text-xs font-medium text-[#b5915a] mb-3 uppercase tracking-wider">{product.tagline}</p>

              <p className="text-[#666666] text-sm leading-relaxed mb-5">{product.description}</p>

              {/* Features */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {product.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#b5915a] flex-shrink-0 mt-0.5" />
                    <span className="text-[#808080] text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="flex items-center gap-1.5 text-[#b5915a] text-sm font-semibold opacity-70 group-hover:opacity-100 transition-all duration-300">
                Request Demo
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
