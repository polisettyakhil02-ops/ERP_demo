'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mail, MapPin, Clock, ChevronDown, MessageCircle, Linkedin } from 'lucide-react'
import { slideLeftVariants, slideRightVariants, viewportConfig } from '@/lib/motion'

const PURPOSES = [
  { value: '', label: 'Select a topic…' },
  { value: 'HIVE ERP', label: 'HIVE ERP — School Management System' },
  { value: 'Vision Digital Boards', label: 'Vision Digital Boards' },
  { value: 'Software Solutions', label: 'Software Solutions' },
  { value: 'Hardware', label: 'Hardware & Infrastructure' },
]

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
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !purpose) return
    setSubmitted(true)
  }

  const waMessage = encodeURIComponent(
    `Hi Dominare Tech,\n\nMy name is ${name}.\nI'd like to enquire about: ${purpose}.\n\nPlease get in touch with me.`
  )
  const mailSubject = encodeURIComponent(`Enquiry: ${purpose}`)
  const mailBody = encodeURIComponent(
    `Hi Dominare Tech,\n\nMy name is ${name}.\nI'd like to enquire about: ${purpose}.\n\nPlease get in touch with me.`
  )

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
            Tell us what you need and we&rsquo;ll connect with you directly — via WhatsApp or email, whichever suits you best.
          </motion.p>
        </div>
      </section>

      {/* Main grid */}
      <section className="section-padding border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

            {/* Left: contact details */}
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
                  Based in Hyderabad, serving clients across India and internationally. Fill the form and we&rsquo;ll reach out within one business day.
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

                {/* LinkedIn */}
                <a
                  href="https://www.linkedin.com/in/dominare-tech-a05b9a391/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card p-5 flex items-center gap-4 hover:border-[#b5915a]/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#b5915a]/10 flex items-center justify-center flex-shrink-0">
                    <Linkedin className="w-5 h-5 text-[#b5915a]" />
                  </div>
                  <div>
                    <div className="text-[#505050] text-xs uppercase tracking-wider mb-1">LinkedIn</div>
                    <span className="text-[#c0c0c0] text-sm group-hover:text-white transition-colors">
                      Dominare Tech
                    </span>
                  </div>
                </a>
              </div>
            </motion.div>

            {/* Right: enquiry form / result */}
            <motion.div
              variants={slideRightVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
              className="lg:col-span-3"
            >
              <div className="glass-card p-8 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {!submitted ? (
                    /* ── Enquiry form ── */
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                      onSubmit={handleSubmit}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-white font-bold text-lg mb-1">Send an Enquiry</h3>
                        <p className="text-[#505050] text-sm">We&rsquo;ll direct your message to the right team.</p>
                      </div>

                      {/* Full name */}
                      <div>
                        <label className="block text-[#606060] text-xs uppercase tracking-wider mb-2">
                          Full Name <span className="text-[#b5915a]">*</span>
                        </label>
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your full name"
                          className="form-input"
                        />
                      </div>

                      {/* Purpose dropdown */}
                      <div>
                        <label className="block text-[#606060] text-xs uppercase tracking-wider mb-2">
                          Purpose of Contact <span className="text-[#b5915a]">*</span>
                        </label>
                        <div className="relative">
                          <select
                            required
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            className="form-input appearance-none pr-10 cursor-pointer"
                            style={{ color: purpose ? '#ffffff' : '#404040' }}
                          >
                            {PURPOSES.map((p) => (
                              <option
                                key={p.value}
                                value={p.value}
                                disabled={p.value === ''}
                                style={{ background: '#111111', color: p.value ? '#ffffff' : '#606060' }}
                              >
                                {p.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505050] pointer-events-none" />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="btn-bronze w-full flex items-center justify-center gap-2"
                      >
                        Continue →
                      </button>

                      <p className="text-[#404040] text-xs text-center">
                        By submitting you agree to be contacted by Dominare Tech via WhatsApp or email.
                      </p>
                    </motion.form>
                  ) : (
                    /* ── Contact options ── */
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      {/* Summary pill */}
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-[#b5915a]/8 border border-[#b5915a]/20">
                        <div className="w-2 h-2 rounded-full bg-[#b5915a] flex-shrink-0" />
                        <p className="text-sm text-[#c0c0c0]">
                          <span className="text-white font-semibold">{name}</span>
                          &nbsp;&mdash;&nbsp;enquiry about&nbsp;
                          <span className="text-[#b5915a] font-semibold">{purpose}</span>
                        </p>
                      </div>

                      <div>
                        <h3 className="text-white font-bold text-lg mb-1">Choose how to reach us</h3>
                        <p className="text-[#505050] text-sm">
                          Both options will pre-fill your enquiry details so you don&rsquo;t have to repeat yourself.
                        </p>
                      </div>

                      {/* WhatsApp */}
                      <a
                        href={`https://wa.me/918688361839?text=${waMessage}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-5 p-6 rounded-2xl border border-white/8 bg-white/[0.02] hover:border-[#25D366]/30 hover:bg-[#25D366]/5 transition-all duration-200 group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-[#25D366]/15 flex items-center justify-center flex-shrink-0">
                          <MessageCircle className="w-6 h-6 text-[#25D366]" />
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-semibold text-sm mb-0.5">WhatsApp</div>
                          <div className="text-[#505050] text-xs">+91 86883 61839 — instant reply during business hours</div>
                        </div>
                        <span className="text-[#25D366] text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          Open →
                        </span>
                      </a>

                      {/* Email */}
                      <a
                        href={`mailto:support@dominaretech.com?subject=${mailSubject}&body=${mailBody}`}
                        className="flex items-center gap-5 p-6 rounded-2xl border border-white/8 bg-white/[0.02] hover:border-[#b5915a]/30 hover:bg-[#b5915a]/5 transition-all duration-200 group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-[#b5915a]/10 flex items-center justify-center flex-shrink-0">
                          <Mail className="w-6 h-6 text-[#b5915a]" />
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-semibold text-sm mb-0.5">Email</div>
                          <div className="text-[#505050] text-xs">support@dominaretech.com — response within 1 business day</div>
                        </div>
                        <span className="text-[#b5915a] text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          Open →
                        </span>
                      </a>

                      <button
                        onClick={() => { setSubmitted(false); setName(''); setPurpose('') }}
                        className="text-[#505050] hover:text-white text-xs transition-colors w-full text-center pt-2"
                      >
                        ← Start over
                      </button>
                    </motion.div>
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
