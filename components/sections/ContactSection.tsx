'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Phone, Mail, Clock, CheckCircle2, Send, ArrowRight } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import { viewportConfig, slideLeftVariants, slideRightVariants } from '@/lib/motion'

const CONTACT_INFO = [
  { icon: MapPin, label: 'Address', value: '100 Enterprise Way, Tech District\nNew York, NY 10001' },
  { icon: Phone, label: 'Phone', value: '+1 (800) 467-TECH', href: 'tel:+18004673824' },
  { icon: Mail, label: 'Email', value: 'enterprise@dominaretech.com', href: 'mailto:enterprise@dominaretech.com' },
  { icon: Clock, label: 'Hours', value: 'Mon – Fri: 8AM – 8PM EST\n24/7 Emergency Support' },
]

interface FormData {
  name: string
  email: string
  company: string
  phone: string
  message: string
}

const INITIAL_FORM: FormData = {
  name: '',
  email: '',
  company: '',
  phone: '',
  message: '',
}

export default function ContactSection() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 1200)
  }

  const handleReset = () => {
    setSubmitted(false)
    setForm(INITIAL_FORM)
  }

  return (
    <section id="contact" className="section-padding bg-[#f5f5f5] relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 50% 60% at 0% 100%, rgba(181,145,90,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeader
          label="Get In Touch"
          title="Let's Start a Conversation"
          subtitle="Whether you have a project in mind or simply want to explore how Dominare can help your organisation — we'd love to hear from you."
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
          {/* Contact info */}
          <motion.div
            variants={slideLeftVariants}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
            className="lg:col-span-2 space-y-4"
          >
            {CONTACT_INFO.map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="glass-card p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#b5915a]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#b5915a]" />
                </div>
                <div>
                  <p className="text-[#777777] text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
                  {href ? (
                    <a href={href} className="text-[#555555] text-sm hover:text-[#0a0a0a] transition-colors whitespace-pre-line leading-relaxed">
                      {value}
                    </a>
                  ) : (
                    <p className="text-[#555555] text-sm whitespace-pre-line leading-relaxed">{value}</p>
                  )}
                </div>
              </div>
            ))}

            {/* CTA note */}
            <div className="glass-card p-5 border-[#b5915a]/20" style={{ borderColor: 'rgba(181,145,90,0.2)' }}>
              <p className="text-[#666666] text-sm leading-relaxed">
                <span className="text-[#b5915a] font-semibold">Enterprise inquiries</span> typically receive a response within 4 business hours. For urgent matters, please call our direct line.
              </p>
              <button
                onClick={() => document.getElementById('contact-form')?.querySelector('input')?.focus()}
                className="mt-4 flex items-center gap-1.5 text-[#b5915a] text-sm font-semibold"
              >
                Start your inquiry
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            variants={slideRightVariants}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
            className="lg:col-span-3"
          >
            <div className="glass-card p-8 relative overflow-hidden" id="contact-form">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center text-center py-12 gap-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-[#b5915a]/15 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-[#b5915a]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#0a0a0a]">Message Sent</h3>
                    <p className="text-[#666666] text-sm max-w-xs">
                      Thank you for reaching out. Our enterprise team will be in touch within 4 business hours.
                    </p>
                    <button onClick={handleReset} className="btn-outline mt-4 py-2.5 px-6 text-sm">
                      Send Another Message
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-5"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[#777777] text-xs font-medium uppercase tracking-wider mb-2" htmlFor="name">
                          Full Name *
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          value={form.name}
                          onChange={handleChange}
                          placeholder="John Smith"
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="block text-[#777777] text-xs font-medium uppercase tracking-wider mb-2" htmlFor="email">
                          Email Address *
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={form.email}
                          onChange={handleChange}
                          placeholder="john@company.com"
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[#777777] text-xs font-medium uppercase tracking-wider mb-2" htmlFor="company">
                          Company *
                        </label>
                        <input
                          id="company"
                          name="company"
                          type="text"
                          required
                          value={form.company}
                          onChange={handleChange}
                          placeholder="Your Organisation"
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="block text-[#777777] text-xs font-medium uppercase tracking-wider mb-2" htmlFor="phone">
                          Phone Number
                        </label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={form.phone}
                          onChange={handleChange}
                          placeholder="+1 (800) 000-0000"
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#777777] text-xs font-medium uppercase tracking-wider mb-2" htmlFor="message">
                        Message *
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={5}
                        value={form.message}
                        onChange={handleChange}
                        placeholder="Tell us about your project, goals, and timeline..."
                        className="form-input resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-bronze w-full py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Message
                        </>
                      )}
                    </button>

                    <p className="text-[#999999] text-xs text-center">
                      By submitting, you agree to our privacy policy. We&rsquo;ll never share your details.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Map placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportConfig}
          transition={{ duration: 0.6 }}
          className="glass-card overflow-hidden"
          style={{ aspectRatio: '21/5', minHeight: '200px' }}
        >
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0d0d0d]">
            <div className="w-12 h-12 rounded-full bg-[#b5915a]/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-[#b5915a]" />
            </div>
            <div className="text-center">
              <p className="text-[#aaaaaa] text-sm font-medium">Interactive Map</p>
              <p className="text-[#252525] text-xs mt-0.5">100 Enterprise Way, Tech District, New York, NY 10001</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
