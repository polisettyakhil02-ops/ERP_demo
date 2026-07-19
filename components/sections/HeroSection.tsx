'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Calendar, ChevronDown } from 'lucide-react'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  delay: number
  duration: number
  variant: 'float' | 'floatDelayed'
}

function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Orb 1 — top-left, cool blue */}
      <div
        className="absolute -top-40 -left-40 w-[80vw] h-[80vw] max-w-[900px] max-h-[900px] rounded-full opacity-100"
        style={{
          background: 'radial-gradient(circle at center, rgba(60, 80, 200, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'gradientShift 18s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
      {/* Orb 2 — bottom-right, bronze */}
      <div
        className="absolute -bottom-40 -right-20 w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(181, 145, 90, 0.07) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'gradientShift2 22s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
      {/* Orb 3 — center, subtle white */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(0, 0, 0, 0.015) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'gradientShift3 14s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  )
}

function FloatingParticles({ particles }: { particles: Particle[] }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animation: `${p.variant} ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function HeroSection() {
  const particles = useMemo<Particle[]>(() => {
    const data: Particle[] = []
    const positions = [
      [12, 20], [85, 15], [25, 70], [70, 60], [45, 35],
      [90, 80], [15, 85], [60, 10], [35, 90], [78, 45],
      [50, 55], [8, 50], [92, 30], [40, 15], [65, 75],
      [20, 40], [75, 25], [55, 85], [30, 60], [88, 65],
    ]
    positions.forEach(([x, y], i) => {
      data.push({
        id: i,
        x: x,
        y: y,
        size: 2 + (i % 4),
        delay: (i * 0.4) % 4,
        duration: 4 + (i % 5),
        variant: i % 3 === 0 ? 'floatDelayed' : 'float',
      })
    })
    return data
  }, [])

  const handleScroll = (href: string) => {
    const id = href.replace('#', '')
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="home"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-white"
    >
      <GradientMesh />
      <FloatingParticles particles={particles} />

      {/* Main content */}
      <div className="relative z-10 text-center max-w-5xl mx-auto px-6 py-24">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2.5 glass-card px-5 py-2.5 mb-8 text-sm text-[#555555]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#b5915a]" style={{ animation: 'dotPulse 2s ease-in-out infinite' }} />
          Enterprise Technology Solutions
          <span className="w-px h-3.5 bg-black/10" />
          <span className="text-[#666666]">Est. 2018</span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="font-black leading-none tracking-tight mb-6"
          style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)' }}
        >
          Engineering Tomorrow.
          <br />
          <span className="text-[#2a2a2a]">Building Intelligent</span>
          <br />
          Digital Enterprises.
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="text-lg md:text-xl text-[#666666] max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Dominare Tech Group delivers enterprise software, AI, automation, cloud infrastructure and digital transformation solutions that help organisations innovate faster and scale globally.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            onClick={() => handleScroll('#services')}
            className="btn-bronze text-base gap-2 flex items-center"
          >
            Explore Solutions
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('#contact')}
            className="btn-outline text-base gap-2 flex items-center"
          >
            <Calendar className="w-4 h-4" />
            Book Consultation
          </button>
        </motion.div>

        {/* Trusted by strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-16 pt-8 border-t border-black/[0.07]"
        >
          <p className="text-xs text-[#999999] uppercase tracking-widest mb-4">Trusted by enterprises across</p>
          <div className="flex flex-wrap justify-center gap-6 text-[#aaaaaa] text-sm font-medium">
            {['Healthcare', 'Finance', 'Manufacturing', 'Logistics', 'Government', 'Retail'].map((industry) => (
              <span key={industry}>{industry}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer"
        onClick={() => handleScroll('#about')}
      >
        <span className="text-[#999999] text-xs tracking-widest uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="w-5 h-5 text-[#b5915a]" />
        </motion.div>
      </motion.div>
    </section>
  )
}
