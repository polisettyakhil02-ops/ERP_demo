'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SectionHeader from '@/components/ui/SectionHeader'
import { containerVariants, scaleVariants, viewportConfig } from '@/lib/motion'

interface Tech {
  name: string
  color: string
  category: string
  abbr: string
}

const TECH_STACK: Tech[] = [
  { name: 'React', color: '#61DAFB', category: 'Frontend', abbr: 'Re' },
  { name: 'Next.js', color: '#ffffff', category: 'Frontend', abbr: 'N' },
  { name: 'TypeScript', color: '#3178C6', category: 'Frontend', abbr: 'TS' },
  { name: 'Node.js', color: '#68A063', category: 'Backend', abbr: 'No' },
  { name: 'Python', color: '#FFD43B', category: 'Backend', abbr: 'Py' },
  { name: 'Java', color: '#F89820', category: 'Backend', abbr: 'Jv' },
  { name: 'Azure', color: '#0078D4', category: 'Cloud', abbr: 'Az' },
  { name: 'AWS', color: '#FF9900', category: 'Cloud', abbr: 'AW' },
  { name: 'Docker', color: '#2496ED', category: 'DevOps', abbr: 'Do' },
  { name: 'Kubernetes', color: '#326CE5', category: 'DevOps', abbr: 'K8' },
  { name: 'TensorFlow', color: '#FF6F00', category: 'AI/ML', abbr: 'TF' },
  { name: 'OpenAI', color: '#10A37F', category: 'AI/ML', abbr: 'OA' },
  { name: 'MongoDB', color: '#47A248', category: 'Database', abbr: 'Mg' },
  { name: 'PostgreSQL', color: '#336791', category: 'Database', abbr: 'PG' },
  { name: 'Redis', color: '#DC382D', category: 'Database', abbr: 'Rd' },
  { name: 'Terraform', color: '#7B42BC', category: 'DevOps', abbr: 'Tf' },
]

const CATEGORIES = ['All', 'Frontend', 'Backend', 'Cloud', 'DevOps', 'AI/ML', 'Database']

export default function TechStackSection() {
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = activeCategory === 'All'
    ? TECH_STACK
    : TECH_STACK.filter((t) => t.category === activeCategory)

  return (
    <section id="tech-stack" className="section-padding bg-[#0a0a0a] relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 50% 50% at 100% 0%, rgba(181,145,90,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeader
          label="Innovation Stack"
          title="Technology We Master"
          subtitle="Our engineers are certified and battle-tested across the technologies that power modern enterprises — from cloud-native infrastructure to AI at production scale."
        />

        {/* Category filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`filter-pill ${activeCategory === cat ? 'active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3"
          layout
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((tech) => (
              <motion.div
                key={tech.name}
                layout
                variants={scaleVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.8 }}
                className="glass-card py-6 px-3 flex flex-col items-center gap-3 group cursor-default hover:bg-white/[0.05] transition-colors duration-200"
              >
                {/* Colored orb / abbr */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: `${tech.color}18`,
                    color: tech.color,
                    border: `1px solid ${tech.color}30`,
                  }}
                >
                  {tech.abbr}
                </div>
                <span className="text-[#a0a0a0] text-xs font-medium text-center leading-tight group-hover:text-white transition-colors duration-200">
                  {tech.name}
                </span>
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ color: tech.color }}
                >
                  {tech.category}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportConfig}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 glass-card p-8 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { value: '16+', label: 'Core Technologies' },
            { value: '50+', label: 'Integrations Supported' },
            { value: '100%', label: 'Cloud-Native Capable' },
            { value: '24/7', label: 'Platform Monitoring' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl md:text-3xl font-black text-white mb-1">{value}</div>
              <div className="text-[#505050] text-sm">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
