'use client'

import { motion } from 'framer-motion'
import { GraduationCap, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function HiveErpPlaceholder() {
  return (
    <div className="bg-[#0a0a0a] min-h-screen flex items-center justify-center relative overflow-hidden pt-20">
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(181,145,90,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-2xl mx-auto px-6 text-center relative z-10">
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-20 h-20 rounded-3xl bg-[#b5915a]/10 border border-[#b5915a]/20 flex items-center justify-center mx-auto mb-8"
        >
          <GraduationCap className="w-9 h-9 text-[#b5915a]" />
        </motion.div>

        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <span className="bronze-label">School Management System</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="section-title mb-5"
        >
          HIVE ERP
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-[#606060] text-lg leading-relaxed mb-10"
        >
          A purpose-built school management platform covering admissions, fees, attendance, timetables, parent communication, and more — all in one place.
        </motion.p>

        {/* Coming soon pill */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="inline-flex items-center gap-2 glass-card px-5 py-2.5 mb-10"
        >
          <span className="w-2 h-2 rounded-full bg-[#b5915a] animate-pulse" />
          <span className="text-[#a0a0a0] text-sm">Full product page coming soon</span>
        </motion.div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/contact" className="btn-bronze">
            Request a Demo
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#606060] hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
