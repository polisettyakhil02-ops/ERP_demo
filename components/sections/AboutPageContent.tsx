'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Target, Eye, Heart, MapPin, Users, Calendar } from 'lucide-react'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import {
  containerVariants,
  fadeUpVariants,
  slideLeftVariants,
  slideRightVariants,
  scaleVariants,
  viewportConfig,
} from '@/lib/motion'

const VALUES = [
  {
    icon: Target,
    label: 'Our Mission',
    text: 'To empower businesses and educational institutions with technology solutions that are reliable, scalable, and genuinely built around their needs — not off-the-shelf templates.',
  },
  {
    icon: Eye,
    label: 'Our Vision',
    text: 'To be the most trusted technology partner for growing organisations across India and beyond — from local schools to multinational enterprises.',
  },
  {
    icon: Heart,
    label: 'Our Values',
    text: 'Honest communication, real results, long-term relationships. We treat every client\'s project as if it were our own — with the attention, craft, and commitment it deserves.',
  },
]

const CORE_VALUES = [
  'Client-First Thinking',
  'Honest Communication',
  'Quality Over Shortcuts',
  'Long-Term Partnership',
  'On-Time Delivery',
  'Post-Launch Support',
]

const STATS = [
  { target: 5, suffix: '+', label: 'Clients Served', description: 'Schools, businesses & enterprises' },
  { target: 3, suffix: '+', label: 'Years of Experience', description: 'Building real solutions' },
  { static: '99%', label: 'Client Retention', description: 'They come back' },
  { static: '24/7', label: 'Support Coverage', description: 'Always available' },
]

type Stat =
  | { target: number; suffix: string; static?: never; label: string; description: string }
  | { static: string; target?: never; suffix?: never; label: string; description: string }

export default function AboutPageContent() {
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4"
          >
            <span className="bronze-label">About Us</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="section-title mb-5 max-w-3xl mx-auto"
          >
            Building Technology That Works — Honestly.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg text-[#666666] max-w-2xl mx-auto leading-relaxed"
          >
            Dominare Tech Pvt Ltd is a Hyderabad-based technology company delivering custom software, enterprise ERP systems, and hardware infrastructure solutions to schools, businesses, and growing organisations.
          </motion.p>

          {/* Location pill */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="inline-flex items-center gap-2 glass-card px-4 py-2 mt-6 text-sm text-[#666666]"
          >
            <MapPin className="w-4 h-4 text-[#b5915a]" />
            Somajiguda, Hyderabad, Telangana
          </motion.div>
        </div>
      </section>

      {/* Story + Stats */}
      <section className="section-padding border-t border-black/[0.07]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: Story */}
            <motion.div
              variants={slideLeftVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
            >
              <span className="bronze-label mb-6 block">Our Story</span>
              <h2 className="section-title mb-6 text-left" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
                Started Small. Built With Purpose.
              </h2>
              <p className="text-[#666666] leading-relaxed mb-4 text-base">
                Dominare Tech was founded with a straightforward idea: that small businesses and educational institutions deserve the same quality of technology that large corporations enjoy — without the enterprise price tag or the bureaucracy.
              </p>
              <p className="text-[#666666] leading-relaxed mb-4 text-base">
                We started by building websites and quickly expanded into school ERP systems, Android applications, e-commerce platforms, and hardware infrastructure. Today, we serve clients across education, business, and services — always staying close, communicating honestly, and delivering on what we promise.
              </p>
              <p className="text-[#666666] leading-relaxed mb-8 text-base">
                Every solution we&rsquo;ve built has been shaped by real conversations with real people. That&rsquo;s not a tagline — it&rsquo;s just how we work.
              </p>

              {/* Core values */}
              <div className="grid grid-cols-2 gap-3">
                {CORE_VALUES.map((value) => (
                  <div key={value} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#b5915a] flex-shrink-0" />
                    <span className="text-[#555555] text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: Stats */}
            <motion.div
              variants={slideRightVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
            >
              <div className="grid grid-cols-2 gap-4 mb-5">
                {(STATS as Stat[]).map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    variants={scaleVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={viewportConfig}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card p-7 text-center"
                  >
                    <div className="text-4xl font-black text-[#0a0a0a] mb-1.5">
                      {stat.target != null ? (
                        <AnimatedCounter target={stat.target} suffix={stat.suffix ?? ''} duration={1800} />
                      ) : (
                        stat.static
                      )}
                    </div>
                    <div className="text-[#0a0a0a] font-semibold text-sm mb-1">{stat.label}</div>
                    <div className="text-[#777777] text-xs">{stat.description}</div>
                  </motion.div>
                ))}
              </div>

              {/* Company details card */}
              <div className="glass-card p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[#b5915a]" />
                  <span className="text-[#666666] text-sm">Incorporated in India</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#b5915a]" />
                  <span className="text-[#666666] text-sm">H. No. 6-3-1093/406, V V Vintage Boulevard, Somajiguda, Hyderabad – 500082</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-[#b5915a]" />
                  <span className="text-[#666666] text-sm">Cross-functional team across development, design & infrastructure</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission / Vision / Values */}
      <section className="section-padding bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportConfig}
            className="text-center mb-14"
          >
            <span className="bronze-label">What Drives Us</span>
            <h2 className="section-title mt-4 max-w-2xl mx-auto">Mission, Vision & Values</h2>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {VALUES.map(({ icon: Icon, label, text }) => (
              <motion.div key={label} variants={fadeUpVariants} className="glass-card p-8">
                <div className="w-12 h-12 rounded-2xl bg-[#b5915a]/10 flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-[#b5915a]" />
                </div>
                <h3 className="text-[#0a0a0a] font-bold text-lg mb-3">{label}</h3>
                <p className="text-[#666666] text-sm leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  )
}
