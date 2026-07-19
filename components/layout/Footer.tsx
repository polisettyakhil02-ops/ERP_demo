'use client'

import { motion } from 'framer-motion'
import { containerVariants, fadeUpVariants, viewportConfig } from '@/lib/motion'
import { Github, Linkedin, Twitter, Instagram, Mail, Phone, MapPin, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const QUICK_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Solutions', href: '/#services' },
  { label: 'HIVE ERP', href: '/hive-erp' },
  { label: 'Industries', href: '/#industries' },
  { label: 'About', href: '/about' },
  { label: 'Careers', href: '/#careers' },
  { label: 'Contact', href: '/contact' },
]

const SOLUTIONS = [
  'Website Development',
  'Web App Development',
  'Android Applications',
  'E-commerce & Shopify',
  'Custom Software',
  'Hardware & Infrastructure',
]

const SOCIAL = [
  { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/in/dominare-tech-a05b9a391/' },
  { icon: Twitter, label: 'Twitter', href: '#' },
  { icon: Instagram, label: 'Instagram', href: '#' },
  { icon: Github, label: 'GitHub', href: '#' },
]

export default function Footer() {
  return (
    <footer className="bg-[#ebebeb] border-t border-black/[0.07]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12"
        >
          {/* Brand column */}
          <motion.div variants={fadeUpVariants} className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#b5915a] to-[#9a7a47] flex items-center justify-center flex-shrink-0">
                <span className="text-[#0a0a0a] font-black text-sm">D</span>
              </div>
              <div className="leading-tight">
                <span className="text-[#0a0a0a] font-black text-base tracking-tight">Dominare</span>
                <span className="text-[#555555] font-medium text-base tracking-tight"> Tech Pvt Ltd</span>
              </div>
            </Link>
            <p className="text-[#777777] text-sm leading-relaxed mb-6">
              Engineering tomorrow. Delivering custom software, enterprise solutions, and infrastructure that powers growing businesses across India and the world.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-[#777777] hover:text-[#b5915a] hover:border-[#b5915a]/40 transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={fadeUpVariants}>
            <h4 className="bronze-label mb-5">Quick Links</h4>
            <ul className="space-y-3 mt-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-1.5 text-[#777777] hover:text-[#0a0a0a] text-sm transition-colors duration-200"
                  >
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#b5915a] -ml-1 transition-all duration-200 group-hover:translate-x-0.5" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Solutions */}
          <motion.div variants={fadeUpVariants}>
            <h4 className="bronze-label mb-5">Solutions</h4>
            <ul className="space-y-3 mt-3">
              {SOLUTIONS.map((s) => (
                <li key={s}>
                  <Link
                    href="/#services"
                    className="group flex items-center gap-1.5 text-[#777777] hover:text-[#0a0a0a] text-sm transition-colors duration-200"
                  >
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#b5915a] -ml-1 transition-all duration-200 group-hover:translate-x-0.5" />
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div variants={fadeUpVariants}>
            <h4 className="bronze-label mb-5">Contact Us</h4>
            <ul className="space-y-4 mt-3">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#b5915a] flex-shrink-0 mt-0.5" />
                <span className="text-[#777777] text-sm leading-relaxed">
                  H. No. 6-3-1093/406, V V Vintage Boulevard,<br />
                  Somajiguda, Hyderabad,<br />
                  Telangana – 500082
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#b5915a] flex-shrink-0" />
                <a href="tel:+918688361839" className="text-[#777777] hover:text-[#0a0a0a] text-sm transition-colors">
                  +91 86883 61839
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#b5915a] flex-shrink-0" />
                <a href="mailto:support@dominaretech.com" className="text-[#777777] hover:text-[#0a0a0a] text-sm transition-colors">
                  support@dominaretech.com
                </a>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom bar */}
        <div className="border-t border-black/[0.07] py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[#353535] text-sm">
            &copy; {new Date().getFullYear()} Dominare Tech Pvt Ltd. All rights reserved.
          </p>
          <p className="text-[#353535] text-sm">
            Somajiguda, Hyderabad, Telangana
          </p>
        </div>
      </div>
    </footer>
  )
}
