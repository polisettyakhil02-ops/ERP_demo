'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Target, Eye, Heart } from 'lucide-react'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import {
  containerVariants,
  fadeUpVariants,
  slideLeftVariants,
  slideRightVariants,
  viewportConfig,
  scaleVariants,
} from '@/lib/motion'

type Stat =
  | { target: number; suffix: string; static?: never; label: string; description: string }
  | { static: string; target?: never; suffix?: never; label: string; description: string }

const STATS: Stat[] = [
  { target: 50, suffix: '+', label: 'Enterprise Clients', description: 'Across 4 continents' },
  { target: 10, suffix: '+', label: 'Industries Served', description: 'Diverse sector expertise' },
  { static: '99.9%', label: 'Reliability SLA', description: 'Uptime guaranteed' },
  { static: '24/7', label: 'Support Coverage', description: 'Always-on enterprise support' },
]

const VALUES = [
  { icon: Target, label: 'Mission', text: 'To empower organisations with transformative technology that drives measurable business outcomes and lasting competitive advantage.' },
  { icon: Eye, label: 'Vision', text: 'To be the most trusted enterprise technology partner globally — building the digital infrastructure that powers the next generation of industry leaders.' },
  { icon: Heart, label: 'Values', text: 'Integrity in every engagement, excellence in every deliverable, and partnership in every client relationship — from first deployment to long-term growth.' },
]

export default function AboutSection() {
  return (
    <section id="about" className="section-padding bg-white relative overflow-hidden">
      {/* Subtle background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(181,145,90,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportConfig}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <span className="bronze-label">Who We Are</span>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left column */}
          <motion.div
            variants={slideLeftVariants}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            <h2 className="section-title mb-6">
              Pioneering the Future of Enterprise Technology
            </h2>
            <p className="text-[#666666] leading-relaxed mb-6 text-base">
              Founded on the belief that technology should be a force multiplier for human ambition, Dominare Tech Group has grown into a leading enterprise solutions provider trusted by organisations across industries and continents.
            </p>
            <p className="text-[#666666] leading-relaxed mb-10 text-base">
              We combine deep technical expertise with strategic thinking to deliver solutions that don&rsquo;t just solve today&rsquo;s problems — they build the foundation for tomorrow&rsquo;s opportunities. Every engagement is a partnership built on transparency, expertise, and a shared commitment to results.
            </p>

            {/* Mission / Vision / Values */}
            <div className="space-y-5">
              {VALUES.map(({ icon: Icon, label, text }) => (
                <div key={label} className="flex gap-4 glass-card p-5">
                  <div className="w-10 h-10 rounded-xl bg-[#b5915a]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#b5915a]" />
                  </div>
                  <div>
                    <h4 className="text-[#0a0a0a] font-semibold text-sm mb-1">{label}</h4>
                    <p className="text-[#666666] text-sm leading-relaxed">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right column — stats */}
          <motion.div
            variants={slideRightVariants}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            <div className="grid grid-cols-2 gap-5">
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  variants={scaleVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={viewportConfig}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-8 text-center"
                >
                  <div className="text-4xl md:text-5xl font-black text-[#0a0a0a] mb-2 tracking-tight">
                    {stat.target != null ? (
                      <AnimatedCounter target={stat.target} suffix={stat.suffix ?? ''} duration={2200} />
                    ) : (
                      stat.static
                    )}
                  </div>
                  <div className="text-[#0a0a0a] font-semibold text-sm mb-1">{stat.label}</div>
                  <div className="text-[#777777] text-xs">{stat.description}</div>
                </motion.div>
              ))}
            </div>

            {/* Core values checklist */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
              className="mt-6 glass-card p-6"
            >
              <p className="text-[#555555] text-xs font-semibold uppercase tracking-widest mb-4">Core Values</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Client-First Thinking',
                  'Technical Excellence',
                  'Radical Transparency',
                  'Continuous Innovation',
                  'Security by Design',
                  'Global Mindset',
                ].map((value) => (
                  <motion.div key={value} variants={fadeUpVariants} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#b5915a] flex-shrink-0" />
                    <span className="text-[#555555] text-sm">{value}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
