'use client'

import { motion } from 'framer-motion'
import { containerVariants, fadeUpVariants, viewportConfig } from '@/lib/motion'

interface SectionHeaderProps {
  label: string
  title: string
  subtitle?: string
  centered?: boolean
  className?: string
}

export default function SectionHeader({
  label,
  title,
  subtitle,
  centered = true,
  className = '',
}: SectionHeaderProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportConfig}
      className={`${centered ? 'text-center' : 'text-left'} mb-16 ${className}`}
    >
      <motion.div variants={fadeUpVariants} className="mb-4">
        <span className="bronze-label">{label}</span>
      </motion.div>

      <motion.h2 variants={fadeUpVariants} className="section-title mb-4 max-w-3xl mx-auto">
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          variants={fadeUpVariants}
          className={`text-lg text-[#a0a0a0] leading-relaxed max-w-2xl ${centered ? 'mx-auto' : ''}`}
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  )
}
