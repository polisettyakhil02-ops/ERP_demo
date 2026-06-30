'use client'

import { motion } from 'framer-motion'
import { containerVariants, fadeUpVariants, viewportConfig } from '@/lib/motion'
import { Github, Linkedin, Twitter, Facebook, Mail, Phone, MapPin, ArrowRight } from 'lucide-react'

const QUICK_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Solutions', href: '#services' },
  { label: 'Industries', href: '#industries' },
  { label: 'Products', href: '#products' },
  { label: 'About', href: '#about' },
  { label: 'Careers', href: '#careers' },
  { label: 'Contact', href: '#contact' },
]

const SOLUTIONS = [
  'Enterprise Software',
  'Artificial Intelligence',
  'Cloud Infrastructure',
  'Data Analytics',
  'Cyber Security',
  'Digital Transformation',
]

const SOCIAL = [
  { icon: Github, label: 'GitHub', href: '#' },
  { icon: Linkedin, label: 'LinkedIn', href: '#' },
  { icon: Twitter, label: 'Twitter', href: '#' },
  { icon: Facebook, label: 'Facebook', href: '#' },
]

export default function Footer() {
  const handleNavClick = (href: string) => {
    const id = href.replace('#', '')
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="bg-[#050505] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Main footer grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12"
        >
          {/* Brand column */}
          <motion.div variants={fadeUpVariants} className="sm:col-span-2 lg:col-span-1">
            <a
              href="#home"
              onClick={(e) => { e.preventDefault(); handleNavClick('#home') }}
              className="flex items-center gap-2 mb-5"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#b5915a] to-[#9a7a47] flex items-center justify-center flex-shrink-0">
                <span className="text-[#0a0a0a] font-black text-sm">D</span>
              </div>
              <div className="leading-tight">
                <span className="text-white font-black text-lg tracking-tight">Dominare</span>
                <span className="text-[#a0a0a0] font-medium text-lg tracking-tight"> Tech Group</span>
              </div>
            </a>
            <p className="text-[#606060] text-sm leading-relaxed mb-6">
              Engineering tomorrow. Building intelligent digital enterprises with cutting-edge technology solutions that scale globally.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-[#606060] hover:text-[#b5915a] hover:border-[#b5915a]/40 transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={fadeUpVariants}>
            <h4 className="text-white font-semibold text-sm tracking-widest uppercase mb-5 bronze-label">
              Quick Links
            </h4>
            <ul className="space-y-3 mt-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); handleNavClick(link.href) }}
                    className="group flex items-center gap-1.5 text-[#606060] hover:text-white text-sm transition-colors duration-200"
                  >
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#b5915a] -ml-1 transition-all duration-200 group-hover:translate-x-0.5" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Solutions */}
          <motion.div variants={fadeUpVariants}>
            <h4 className="text-white font-semibold text-sm tracking-widest uppercase mb-5 bronze-label">
              Solutions
            </h4>
            <ul className="space-y-3 mt-3">
              {SOLUTIONS.map((s) => (
                <li key={s}>
                  <a
                    href="#services"
                    onClick={(e) => { e.preventDefault(); handleNavClick('#services') }}
                    className="group flex items-center gap-1.5 text-[#606060] hover:text-white text-sm transition-colors duration-200"
                  >
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#b5915a] -ml-1 transition-all duration-200 group-hover:translate-x-0.5" />
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div variants={fadeUpVariants}>
            <h4 className="text-white font-semibold text-sm tracking-widest uppercase mb-5 bronze-label">
              Contact
            </h4>
            <ul className="space-y-4 mt-3">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#b5915a] flex-shrink-0 mt-0.5" />
                <span className="text-[#606060] text-sm leading-relaxed">
                  100 Enterprise Way, Tech District<br />New York, NY 10001
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#b5915a] flex-shrink-0" />
                <a href="tel:+18004673824" className="text-[#606060] hover:text-white text-sm transition-colors">
                  +1 (800) 467-TECH
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#b5915a] flex-shrink-0" />
                <a href="mailto:enterprise@dominaretech.com" className="text-[#606060] hover:text-white text-sm transition-colors">
                  enterprise@dominaretech.com
                </a>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[#404040] text-sm">
            &copy; {new Date().getFullYear()} Dominare Tech Group. All rights reserved.
          </p>
          <p className="text-[#404040] text-sm">
            Designed &amp; Built by{' '}
            <span className="text-[#606060]">Dominare Tech Group</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
