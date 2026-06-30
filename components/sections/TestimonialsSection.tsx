'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import { viewportConfig } from '@/lib/motion'

interface Testimonial {
  quote: string
  author: string
  title: string
  company: string
  initials: string
  color: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Dominare Tech Group delivered our enterprise ERP platform on time and significantly above expectations. Their attention to scalability and security architecture is genuinely unmatched in this industry. We now operate 40% more efficiently.",
    author: "Jonathan Wheeler",
    title: "Chief Technology Officer",
    company: "NexaCorp Industries",
    initials: "JW",
    color: '#60a5fa',
  },
  {
    quote: "The AI integration Dominare built for our supply chain reduced manual processing time by 70% within the first quarter. An extraordinary team with deep technical expertise and an uncanny ability to understand complex operational requirements.",
    author: "Priya Nair",
    title: "VP Operations",
    company: "Meridian Logistics",
    initials: "PN",
    color: '#a78bfa',
  },
  {
    quote: "Their cloud migration strategy was flawless — zero downtime, measurable cost savings from day one, and a platform that genuinely scales with our growth trajectory. Dominare set a new benchmark for what we expect from technology partners.",
    author: "Marcus Aldridge",
    title: "Head of Digital Transformation",
    company: "Sterling Finance Group",
    initials: "MA",
    color: '#34d399',
  },
  {
    quote: "From CRM to analytics to our patient management system, every module Dominare built integrates seamlessly. It feels like they understand our healthcare operations as well as our own team does. Outstanding professionalism throughout.",
    author: "Dr. Aisha Rahman",
    title: "Chief Executive Officer",
    company: "Apex Healthcare Systems",
    initials: "AR",
    color: '#fb923c',
  },
]

const INTERVAL = 5000

export default function TestimonialsSection() {
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isPaused, setIsPaused] = useState(false)

  const goTo = useCallback((index: number) => {
    const newIndex = (index + TESTIMONIALS.length) % TESTIMONIALS.length
    setDirection(newIndex > current ? 1 : -1)
    setCurrent(newIndex)
  }, [current])

  const next = useCallback(() => {
    setDirection(1)
    setCurrent((prev) => (prev + 1) % TESTIMONIALS.length)
  }, [])

  const prev = useCallback(() => {
    setDirection(-1)
    setCurrent((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
  }, [])

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(next, INTERVAL)
    return () => clearInterval(timer)
  }, [next, isPaused])

  const active = TESTIMONIALS[current]

  return (
    <section id="testimonials" className="section-padding bg-[#111111] relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(181,145,90,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <SectionHeader
          label="Client Testimonials"
          title="Trusted by Enterprise Leaders"
          subtitle="Don't take our word for it. Here's what the organisations we partner with have to say about working with Dominare."
        />

        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Main testimonial card */}
          <div className="relative min-h-[320px] flex items-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current}
                custom={direction}
                initial={{ opacity: 0, x: direction > 0 ? 80 : -80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -80 : 80 }}
                transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="w-full glass-card p-8 md:p-12 text-center"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                {/* Quote icon */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: `${active.color}15` }}
                >
                  <Quote className="w-6 h-6" style={{ color: active.color }} />
                </div>

                {/* Quote text */}
                <blockquote className="text-lg md:text-xl text-[#c0c0c0] leading-relaxed mb-8 font-light italic max-w-3xl mx-auto">
                  &ldquo;{active.quote}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{
                      background: `${active.color}20`,
                      color: active.color,
                      border: `1px solid ${active.color}30`,
                    }}
                  >
                    {active.initials}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-base">{active.author}</div>
                    <div className="text-[#606060] text-sm mt-0.5">{active.title}</div>
                    <div className="text-[#b5915a] text-xs font-semibold uppercase tracking-wider mt-1">{active.company}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress bar */}
          <div className="mt-6 h-px bg-white/5 rounded-full overflow-hidden">
            <div
              key={`${current}-progress`}
              className="carousel-progress h-full"
              style={{ animationDuration: `${INTERVAL}ms`, animationPlayState: isPaused ? 'paused' : 'running' }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-6">
            {/* Prev button */}
            <button
              onClick={prev}
              className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-[#606060] hover:text-white hover:border-[#b5915a]/40 transition-all duration-200"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Dot indicators */}
            <div className="flex items-center gap-2.5">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === current
                      ? 'w-6 h-2.5 bg-[#b5915a]'
                      : 'w-2.5 h-2.5 bg-[#303030] hover:bg-[#505050]'
                  }`}
                />
              ))}
            </div>

            {/* Next button */}
            <button
              onClick={next}
              className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-[#606060] hover:text-white hover:border-[#b5915a]/40 transition-all duration-200"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Company logos strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportConfig}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-14 text-center"
        >
          <p className="text-[#404040] text-xs uppercase tracking-widest mb-5">Client organisations</p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-[#2a2a2a] text-sm font-semibold tracking-wide">
            {TESTIMONIALS.map((t) => (
              <span key={t.company}>{t.company}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
