'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mail, MapPin, Clock, Send, CheckCircle } from 'lucide-react'
import { slideLeftVariants, slideRightVariants, viewportConfig } from '@/lib/motion'

const CONTACT_INFO = [
  {
    icon: Phone,
    label: 'Phone',
    value: '+91 86883 61839',
    href: 'tel:+918688361839',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'support@dominaretech.com',
    href: 'mailto:support@dominaretech.com',
  },
  {
    icon: MapPin,
    label: 'Address',
    value: 'H. No. 6-3-1093/406, V V Vintage Boulevard, Somajiguda, Hyderabad, Telangana – 500082',
    href: null,
  },
  {
    icon: Clock,
    label: 'Business Hours',
    value: 'Monday – Saturday, 9:00 AM – 7:00 PM IST',
    href: null,
  },
]

export default function ContactPageContent() {
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 1200)
  }

  return (
    <div className="bg-[#0a0a0a] pt-24">
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
            <span className="bronze-label">Get In Touch</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="section-title mb-5 max-w-3xl mx-auto"
          >
            Let&rsquo;s Build Something Together.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg text-[#606060] max-w-2xl mx-auto leading-relaxed"
          >
            Whether you need a website, an ERP system, or complete IT infrastructure — we&rsquo;re here to listen first and build second. Reach out and let&rsquo;s talk.
          </motion.p>
        </div>
      </section>

      {/* Contact grid */}
      <section className="section-padding border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Left: Info */}
            <motion.div
              variants={slideLeftVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
              className="lg:col-span-2 space-y-5"
            >
              <div>
                <h2 className="text-white font-bold text-2xl mb-2">Dominare Tech Pvt Ltd</h2>
                <p className="text-[#606060] text-sm leading-relaxed">
                  We&rsquo;re based in Hyderabad and serve clients across India and internationally. Drop us a message — we respond within one business day.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {CONTACT_INFO.map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="glass-card p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#b5915a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-5 h-5 text-[#b5915a]" />
                    </div>
                    <div>
                      <div className="text-[#505050] text-xs uppercase tracking-wider mb-1">{label}</div>
                      {href ? (
                        <a href={href} className="text-[#c0c0c0] text-sm hover:text-white transition-colors">
                          {value}
                        </a>
                      ) : (
                        <p className="text-[#c0c0c0] text-sm leading-relaxed">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: Form */}
            <motion.div
              variants={slideRightVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
              className="lg:col-span-3"
            >
              <div className="glass-card p-8 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {submitted ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-16 text-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-[#b5915a]/15 flex items-center justify-center mb-5">
                        <CheckCircle className="w-8 h-8 text-[#b5915a]" />
                      </div>
                      <h3 className="text-white font-bold text-xl mb-2">Message Sent</h3>
                      <p className="text-[#606060] text-sm max-w-xs">
                        Thanks for reaching out. We&rsquo;ll get back to you within one business day.
                      </p>
                      <button
                        onClick={() => { setSubmitted(false); setForm({ name: '', email: '', company: '', phone: '', message: '' }) }}
                        className="mt-6 text-[#b5915a] text-sm hover:text-[#c9a96e] transition-colors"
                      >
                        Send another message →
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="space-y-5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[#606060] text-xs uppercase tracking-wider mb-2">Name *</label>
                          <input
                            name="name"
                            required
                            value={form.name}
                            onChange={handleChange}
                            placeholder="Your full name"
                            className="form-input"
                          />
                        </div>
                        <div>
                          <label className="block text-[#606060] text-xs uppercase tracking-wider mb-2">Email *</label>
                          <input
                            name="email"
                            type="email"
                            required
                            value={form.email}
                            onChange={handleChange}
                            placeholder="you@example.com"
                            className="form-input"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[#606060] text-xs uppercase tracking-wider mb-2">Company</label>
                          <input
                            name="company"
                            value={form.company}
                            onChange={handleChange}
                            placeholder="Company or school name"
                            className="form-input"
                          />
                        </div>
                        <div>
                          <label className="block text-[#606060] text-xs uppercase tracking-wider mb-2">Phone</label>
                          <input
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            placeholder="+91 XXXXX XXXXX"
                            className="form-input"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[#606060] text-xs uppercase tracking-wider mb-2">Message *</label>
                        <textarea
                          name="message"
                          required
                          rows={5}
                          value={form.message}
                          onChange={handleChange}
                          placeholder="Tell us about your project or requirement…"
                          className="form-input resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-bronze w-full flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {loading ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {loading ? 'Sending…' : 'Send Message'}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Map placeholder */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="glass-card aspect-video flex flex-col items-center justify-center gap-3 text-center">
            <MapPin className="w-8 h-8 text-[#b5915a]" />
            <p className="text-[#505050] text-sm">Somajiguda, Hyderabad, Telangana – 500082</p>
            <a
              href="https://maps.google.com/?q=Somajiguda,Hyderabad"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#b5915a] text-xs hover:text-[#c9a96e] transition-colors"
            >
              Open in Google Maps →
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
