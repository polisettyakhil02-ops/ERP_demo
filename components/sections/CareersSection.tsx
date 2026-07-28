'use client'

import { motion } from 'framer-motion'
import {
  Heart,
  Globe,
  TrendingUp,
  Coffee,
  BookOpen,
  Users,
  Award,
  Laptop,
  MapPin,
  Clock,
  Briefcase,
  ArrowRight,
} from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import { containerVariants, fadeUpVariants, cardHover, viewportConfig } from '@/lib/motion'

const BENEFITS = [
  { icon: Heart, label: 'Health & Wellness', description: 'Comprehensive medical, dental, and vision coverage for you and your family' },
  { icon: Globe, label: 'Remote Friendly', description: 'Work from anywhere in the world with flexible hybrid arrangements' },
  { icon: TrendingUp, label: 'Career Growth', description: 'Structured growth frameworks with regular promotions and mentorship' },
  { icon: Coffee, label: 'Flexible Hours', description: 'Async-first culture respecting your most productive hours' },
  { icon: BookOpen, label: 'Learning Budget', description: '$3,000 annual budget for courses, certifications, and conferences' },
  { icon: Users, label: 'Great Culture', description: 'A diverse, inclusive team that values every voice and perspective' },
  { icon: Award, label: 'Performance Bonus', description: 'Quarterly performance bonuses tied to individual and company outcomes' },
  { icon: Laptop, label: 'Latest Equipment', description: 'Top-of-the-line MacBook Pro or equivalent, plus home office allowance' },
]

const POSITIONS = [
  {
    title: 'Senior Full-Stack Engineer',
    department: 'Engineering',
    type: 'Full-time',
    location: 'Remote / On-site',
    description: 'Build scalable enterprise applications using React, Node.js, and cloud-native architecture. 5+ years required.',
  },
  {
    title: 'AI/ML Solutions Architect',
    department: 'AI Division',
    type: 'Full-time',
    location: 'Remote',
    description: 'Design and deploy production AI systems for enterprise clients. Deep expertise in LLMs, NLP, and MLOps required.',
  },
  {
    title: 'Enterprise Sales Manager',
    department: 'Business Development',
    type: 'Full-time',
    location: 'Hybrid',
    description: 'Drive new business across Fortune 500 accounts. Proven track record in enterprise B2B sales required.',
  },
  {
    title: 'Cloud DevOps Engineer',
    department: 'Infrastructure',
    type: 'Full-time',
    location: 'Remote',
    description: 'Design and maintain resilient cloud infrastructure on Azure and AWS. Kubernetes and Terraform expertise required.',
  },
]

export default function CareersSection() {
  return (
    <section id="careers" className="section-padding bg-white relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(181,145,90,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeader
          label="Careers"
          title="Build the Future With Us"
          subtitle="We're looking for exceptional engineers, architects, and leaders who want to work on meaningful problems at enterprise scale."
        />

        {/* Benefits grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16"
        >
          {BENEFITS.map((benefit) => (
            <motion.div
              key={benefit.label}
              variants={fadeUpVariants}
              className="glass-card p-5 group cursor-default"
            >
              <div className="w-9 h-9 rounded-xl bg-[#b5915a]/10 flex items-center justify-center mb-3 group-hover:bg-[#b5915a]/15 transition-colors duration-300">
                <benefit.icon className="w-4 h-4 text-[#b5915a]" />
              </div>
              <h4 className="text-[#0a0a0a] font-semibold text-sm mb-1">{benefit.label}</h4>
              <p className="text-[#777777] text-xs leading-relaxed">{benefit.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Culture statement */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportConfig}
          transition={{ duration: 0.6 }}
          className="mb-16 glass-card p-8 md:p-10 relative overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#b5915a] to-[#c9a96e] rounded-l-xl" />
          <div className="pl-4 md:pl-6 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-bold text-[#0a0a0a] mb-3">Our Culture</h3>
              <p className="text-[#666666] leading-relaxed text-sm">
                At Dominare, we believe the best technology is built by the best people — and great people thrive in environments of trust, autonomy, and purpose. We&rsquo;ve built a culture where excellence is recognised, failure is a learning opportunity, and every individual contribution shapes our collective trajectory.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#0a0a0a] mb-3">Our Commitment</h3>
              <p className="text-[#666666] leading-relaxed text-sm">
                We invest in our people with the same rigour we invest in our products. From structured mentorship and leadership development to generous parental leave and mental wellness support — we understand that sustainable excellence requires whole-person care. When you grow, we grow.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Open positions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportConfig}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <span className="bronze-label">Open Positions</span>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {POSITIONS.map((position) => (
            <motion.div
              key={position.title}
              variants={fadeUpVariants}
              whileHover={cardHover}
              className="glass-card p-6 group cursor-default"
            >
              <div className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <h3 className="text-[#0a0a0a] font-semibold text-base mb-1">{position.title}</h3>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#b5915a]/10 text-[#b5915a] border border-[#b5915a]/20">
                    {position.department}
                  </span>
                </div>
                <Briefcase className="w-5 h-5 text-[#aaaaaa] flex-shrink-0 mt-1" />
              </div>

              <p className="text-[#666666] text-sm leading-relaxed mb-4">{position.description}</p>

              <div className="flex flex-wrap gap-4 mb-5">
                <div className="flex items-center gap-1.5 text-[#777777] text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  {position.type}
                </div>
                <div className="flex items-center gap-1.5 text-[#777777] text-xs">
                  <MapPin className="w-3.5 h-3.5" />
                  {position.location}
                </div>
              </div>

              <button className="btn-bronze py-2.5 px-5 text-sm w-full flex items-center justify-center gap-2">
                Apply Now
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={viewportConfig}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-10"
        >
          <p className="text-[#777777] text-sm mb-4">Don&rsquo;t see the right role? We&rsquo;re always looking for exceptional talent.</p>
          <button className="btn-outline py-3 px-8">
            Send Open Application
          </button>
        </motion.div>
      </div>
    </section>
  )
}
