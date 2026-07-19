'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Globe, Database, Cpu } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import { containerVariants, fadeUpVariants, cardHover, viewportConfig } from '@/lib/motion'

interface Client {
  initials: string
  name: string
  shortName: string
  service: string
  serviceType: 'web' | 'erp' | 'hardware'
  location: string
  href: string
  color: string
  bg: string
}

const CLIENTS: Client[] = [
  {
    initials: 'AS',
    name: 'Al Sarah Group',
    shortName: 'Al Sarah Group',
    service: 'Website Development',
    serviceType: 'web',
    location: 'Dubai, UAE',
    href: 'https://www.alsarahgroup.ae/',
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.10)',
  },
  {
    initials: 'MS',
    name: 'The Mastermind Schools',
    shortName: 'Mastermind Schools',
    service: 'HIVE ERP Solution',
    serviceType: 'erp',
    location: 'Hyderabad, India',
    href: 'https://www.themastermindsschools.com/',
    color: '#b5915a',
    bg: 'rgba(181, 145, 90, 0.10)',
  },
  {
    initials: 'KV',
    name: 'Krishna Veni Talent Schools',
    shortName: 'KV Talent Schools',
    service: 'HIVE ERP Solution',
    serviceType: 'erp',
    location: 'Hyderabad, India',
    href: 'https://www.krishnavenitalentschools.com/',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.10)',
  },
  {
    initials: 'CE',
    name: 'Confluence Edu',
    shortName: 'Confluence Edu',
    service: 'Hardware Services',
    serviceType: 'hardware',
    location: 'Hyderabad, India',
    href: 'https://www.confluenceedu.com/',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.10)',
  },
  {
    initials: 'GI',
    name: 'GMR International School',
    shortName: 'GMR International',
    service: 'HIVE ERP Solution',
    serviceType: 'erp',
    location: 'Hyderabad, India',
    href: 'https://gmrinternationalschool.com/',
    color: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.10)',
  },
]

const SERVICE_ICONS = {
  web: Globe,
  erp: Database,
  hardware: Cpu,
}

const SERVICE_COLORS = {
  web: 'rgba(96, 165, 250, 0.12)',
  erp: 'rgba(181, 145, 90, 0.12)',
  hardware: 'rgba(52, 211, 153, 0.12)',
}

const SERVICE_TEXT_COLORS = {
  web: '#60a5fa',
  erp: '#b5915a',
  hardware: '#34d399',
}

export default function ClientsSection() {
  return (
    <section id="clients" className="section-padding bg-[#f5f5f5] relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(181,145,90,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeader
          label="Our Clients"
          title="Trusted by Growing Organisations"
          subtitle="We partner with schools, enterprises, and businesses to deliver technology that works — and keeps working."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {CLIENTS.map((client) => {
            const ServiceIcon = SERVICE_ICONS[client.serviceType]
            return (
              <motion.a
                key={client.name}
                href={client.href}
                target="_blank"
                rel="noopener noreferrer"
                variants={fadeUpVariants}
                whileHover={cardHover}
                className="glass-card p-6 group flex flex-col gap-4"
                style={{ background: 'rgba(0,0,0,0.025)' }}
              >
                {/* Logo placeholder + external link */}
                <div className="flex items-start justify-between">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
                    style={{ background: client.bg, color: client.color, border: `1px solid ${client.color}20` }}
                  >
                    {client.initials}
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#aaaaaa] group-hover:text-[#b5915a] transition-colors duration-200 mt-1" />
                </div>

                {/* Name */}
                <div>
                  <h3 className="text-[#0a0a0a] font-semibold text-base leading-tight mb-0.5">
                    {client.name}
                  </h3>
                  <p className="text-[#777777] text-xs">{client.location}</p>
                </div>

                {/* Service badge */}
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl w-fit"
                  style={{ background: SERVICE_COLORS[client.serviceType] }}
                >
                  <ServiceIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: SERVICE_TEXT_COLORS[client.serviceType] }} />
                  <span className="text-xs font-semibold" style={{ color: SERVICE_TEXT_COLORS[client.serviceType] }}>
                    {client.service}
                  </span>
                </div>
              </motion.a>
            )
          })}

          {/* "More coming soon" placeholder card */}
          <motion.div
            variants={fadeUpVariants}
            className="glass-card p-6 flex flex-col items-center justify-center gap-3 border-dashed"
            style={{ borderColor: 'rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.01)' }}
          >
            <div className="w-14 h-14 rounded-2xl bg-white/3 flex items-center justify-center">
              <span className="text-2xl text-[#aaaaaa] font-black">+</span>
            </div>
            <p className="text-[#999999] text-sm text-center font-medium">More clients joining</p>
            <p className="text-[#aaaaaa] text-xs text-center">Growing portfolio across education, business & healthcare</p>
          </motion.div>
        </motion.div>

        {/* Note about logos */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={viewportConfig}
          transition={{ delay: 0.4 }}
          className="text-center text-[#aaaaaa] text-xs mt-8"
        >
          Client logos can be added — share image files to replace the initials placeholders.
        </motion.p>
      </div>
    </section>
  )
}
