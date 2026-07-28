'use client'

import { motion } from 'framer-motion'
import {
  CheckCircle2, Target, Eye, Heart, MapPin, Users, Calendar,
  ExternalLink, Globe, Database, Cpu, Monitor,
  HeartPulse, GraduationCap, Factory, ShoppingBag, TrendingUp, Landmark, Building2, Truck,
} from 'lucide-react'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import {
  containerVariants,
  fadeUpVariants,
  slideLeftVariants,
  slideRightVariants,
  scaleVariants,
  viewportConfig,
} from '@/lib/motion'

/* ─── ABOUT DATA ─── */
const VALUES = [
  { icon: Target, label: 'Our Mission', text: 'To empower businesses and educational institutions with technology solutions that are reliable, scalable, and genuinely built around their needs — not off-the-shelf templates.' },
  { icon: Eye, label: 'Our Vision', text: 'To be the most trusted technology partner for growing organisations across India and beyond — from local schools to multinational enterprises.' },
  { icon: Heart, label: 'Our Values', text: 'Honest communication, real results, long-term relationships. We treat every client\'s project as if it were our own — with the attention, craft, and commitment it deserves.' },
]

const CORE_VALUES = [
  'Client-First Thinking', 'Honest Communication',
  'Quality Over Shortcuts', 'Long-Term Partnership',
  'On-Time Delivery', 'Post-Launch Support',
]

const STATS = [
  { target: 6, suffix: '+', label: 'Clients Served', description: 'Schools, businesses & enterprises' },
  { target: 3, suffix: '+', label: 'Years of Experience', description: 'Building real solutions' },
  { static: '99%', label: 'Client Retention', description: 'They come back' },
  { static: '24/7', label: 'Support Coverage', description: 'Always available' },
]

type Stat =
  | { target: number; suffix: string; static?: never; label: string; description: string }
  | { static: string; target?: never; suffix?: never; label: string; description: string }

/* ─── TEAM ─── */
const TEAM = [
  { name: 'Akhil Polisetty', role: 'Founder & CEO', initials: 'AP', color: '#b5915a', bg: 'rgba(181,145,90,0.1)', desc: 'Leads product vision, client relationships, and overall strategy.' },
  { name: 'Development Team', role: 'Engineering', initials: 'DT', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', desc: 'Full-stack engineers building HIVE ERP, web apps, and custom software.' },
  { name: 'Infrastructure Team', role: 'Hardware & Networks', initials: 'IT', color: '#34d399', bg: 'rgba(52,211,153,0.1)', desc: 'Handles digital board installations, network setup, and hardware procurement.' },
  { name: 'Support Team', role: 'Client Success', initials: 'ST', color: '#e879f9', bg: 'rgba(232,121,249,0.1)', desc: 'Ensures every client gets the post-launch support they need, always.' },
]

/* ─── CLIENTS ─── */
const CLIENTS = [
  { initials: 'AS', name: 'Al Sarah Group', location: 'Dubai, UAE', service: 'Website Development', serviceType: 'web' as const, href: 'https://www.alsarahgroup.ae/', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  { initials: 'MS', name: 'The Mastermind Schools', location: 'Hyderabad, India', service: 'HIVE ERP Solution', serviceType: 'erp' as const, href: 'https://www.themastermindsschools.com/', color: '#b5915a', bg: 'rgba(181,145,90,0.1)' },
  { initials: 'KV', name: 'Krishna Veni Talent Schools', location: 'Hyderabad, India', service: 'HIVE ERP Solution', serviceType: 'erp' as const, href: 'https://www.krishnavenitalentschools.com/', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  { initials: 'CE', name: 'Confluence Edu', location: 'Hyderabad, India', service: 'Hardware Services', serviceType: 'hardware' as const, href: 'https://www.confluenceedu.com/', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  { initials: 'GI', name: 'GMR International School', location: 'Hyderabad, India', service: 'HIVE ERP Solution', serviceType: 'erp' as const, href: 'https://gmrinternationalschool.com/', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  { initials: 'SH', name: 'Sacred Heart Convent School', location: 'Andhra Pradesh, India', service: 'Vision Digital Boards', serviceType: 'digitalboard' as const, href: 'https://ap106cisce.org/index.php', color: '#e879f9', bg: 'rgba(232,121,249,0.1)' },
]

const SERVICE_ICONS = { web: Globe, erp: Database, hardware: Cpu, digitalboard: Monitor }
const SERVICE_COLORS = { web: 'rgba(96,165,250,0.12)', erp: 'rgba(181,145,90,0.12)', hardware: 'rgba(52,211,153,0.12)', digitalboard: 'rgba(232,121,249,0.12)' }
const SERVICE_TEXT_COLORS = { web: '#60a5fa', erp: '#b5915a', hardware: '#34d399', digitalboard: '#e879f9' }

/* ─── INDUSTRIES ─── */
const INDUSTRIES = [
  { icon: HeartPulse, title: 'Healthcare', desc: 'Digital health platforms, patient management, and clinical data analytics.', count: '12+ clients' },
  { icon: GraduationCap, title: 'Education', desc: 'EdTech platforms, ERP systems, and student analytics for schools and colleges.', count: '8+ clients' },
  { icon: Factory, title: 'Manufacturing', desc: 'Smart factory solutions, production optimisation, and supply chain digitisation.', count: '15+ clients' },
  { icon: ShoppingBag, title: 'Retail', desc: 'Omnichannel commerce, inventory management, POS systems, and customer intelligence.', count: '10+ clients' },
  { icon: TrendingUp, title: 'Finance', desc: 'Fintech solutions, compliance platforms, and financial analytics systems.', count: '9+ clients' },
  { icon: Landmark, title: 'Government', desc: 'e-Governance portals, citizen service systems, and secure public sector infrastructure.', count: '5+ agencies' },
  { icon: Building2, title: 'Real Estate', desc: 'PropTech platforms, property management systems, and smart building solutions.', count: '7+ clients' },
  { icon: Truck, title: 'Logistics', desc: 'Supply chain management, fleet tracking, and last-mile delivery optimisation.', count: '11+ clients' },
]

export default function AboutPageContent() {
  return (
    <div className="bg-white pt-24">

      {/* ── Hero banner ── */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(181,145,90,0.05) 0%, transparent 70%)' }} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-4">
            <span className="bronze-label">About Us</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="section-title mb-5 max-w-3xl mx-auto">
            Building Technology That Works — Honestly.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }} className="text-lg text-[#666666] max-w-2xl mx-auto leading-relaxed">
            Dominare Tech Pvt Ltd is a Hyderabad-based technology company delivering custom software, enterprise ERP systems, digital boards, and hardware infrastructure to schools, businesses, and growing organisations.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="inline-flex items-center gap-2 glass-card px-4 py-2 mt-6 text-sm text-[#666666]">
            <MapPin className="w-4 h-4 text-[#b5915a]" />
            Somajiguda, Hyderabad, Telangana
          </motion.div>
        </div>
      </section>

      {/* ── Story + Stats ── */}
      <section className="section-padding border-t border-black/[0.07]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={slideLeftVariants} initial="hidden" whileInView="visible" viewport={viewportConfig}>
              <span className="bronze-label mb-6 block">Our Story</span>
              <h2 className="section-title mb-6 text-left" style={{ fontSize: 'clamp(1.75rem,3vw,2.5rem)' }}>
                Started Small. Built With Purpose.
              </h2>
              <p className="text-[#666666] leading-relaxed mb-4 text-base">
                Dominare Tech was founded with a straightforward idea: that small businesses and educational institutions deserve the same quality of technology that large corporations enjoy — without the enterprise price tag or the bureaucracy.
              </p>
              <p className="text-[#666666] leading-relaxed mb-8 text-base">
                We started by building websites and quickly expanded into school ERP systems, Android applications, e-commerce platforms, vision digital boards, and hardware infrastructure. Every solution we&rsquo;ve built has been shaped by real conversations with real people.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CORE_VALUES.map((value) => (
                  <div key={value} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#b5915a] flex-shrink-0" />
                    <span className="text-[#555555] text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={slideRightVariants} initial="hidden" whileInView="visible" viewport={viewportConfig}>
              <div className="grid grid-cols-2 gap-4 mb-5">
                {(STATS as Stat[]).map((stat, i) => (
                  <motion.div key={stat.label} variants={scaleVariants} initial="hidden" whileInView="visible" viewport={viewportConfig} transition={{ delay: i * 0.1 }} className="glass-card p-7 text-center">
                    <div className="text-4xl font-black text-[#0a0a0a] mb-1.5">
                      {stat.target != null
                        ? <AnimatedCounter target={stat.target} suffix={stat.suffix ?? ''} duration={1800} />
                        : stat.static}
                    </div>
                    <div className="text-[#0a0a0a] font-semibold text-sm mb-1">{stat.label}</div>
                    <div className="text-[#777777] text-xs">{stat.description}</div>
                  </motion.div>
                ))}
              </div>
              <div className="glass-card p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[#b5915a]" />
                  <span className="text-[#666666] text-sm">Incorporated in India</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#b5915a]" />
                  <span className="text-[#666666] text-sm">H. No. 6-3-1093/406, V V Vintage Boulevard, Somajiguda, Hyderabad – 500082</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-[#b5915a]" />
                  <span className="text-[#666666] text-sm">Cross-functional team across development, design & infrastructure</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Mission / Vision / Values ── */}
      <section className="section-padding bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={viewportConfig} className="text-center mb-14">
            <span className="bronze-label">What Drives Us</span>
            <h2 className="section-title mt-4 max-w-2xl mx-auto">Mission, Vision & Values</h2>
          </motion.div>
          <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={viewportConfig} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {VALUES.map(({ icon: Icon, label, text }) => (
              <motion.div key={label} variants={fadeUpVariants} className="glass-card p-8">
                <div className="w-12 h-12 rounded-2xl bg-[#b5915a]/10 flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-[#b5915a]" />
                </div>
                <h3 className="text-[#0a0a0a] font-bold text-lg mb-3">{label}</h3>
                <p className="text-[#666666] text-sm leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Meet the Team ── */}
      <section className="section-padding bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={viewportConfig} className="text-center mb-14">
            <span className="bronze-label">The People Behind It</span>
            <h2 className="section-title mt-4">Meet the Team</h2>
            <p className="text-[#666666] mt-3 max-w-xl mx-auto text-base leading-relaxed">
              A small, focused team that takes every project personally.
            </p>
          </motion.div>
          <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={viewportConfig} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TEAM.map((member) => (
              <motion.div key={member.name} variants={fadeUpVariants} className="glass-card p-6 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0"
                  style={{ background: member.bg, color: member.color, border: `1px solid ${member.color}25` }}>
                  {member.initials}
                </div>
                <div>
                  <div className="text-[#0a0a0a] font-bold text-base mb-0.5">{member.name}</div>
                  <div className="text-[#b5915a] text-xs font-semibold uppercase tracking-wide mb-2">{member.role}</div>
                  <p className="text-[#666666] text-sm leading-relaxed">{member.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Clients ── */}
      <section className="section-padding bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={viewportConfig} className="text-center mb-14">
            <span className="bronze-label">Our Clients</span>
            <h2 className="section-title mt-4">Trusted by Growing Organisations</h2>
            <p className="text-[#666666] mt-3 max-w-xl mx-auto text-base leading-relaxed">
              We partner with schools, enterprises, and businesses to deliver technology that works — and keeps working.
            </p>
          </motion.div>
          <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={viewportConfig} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CLIENTS.map((client) => {
              const ServiceIcon = SERVICE_ICONS[client.serviceType]
              return (
                <motion.a
                  key={client.name}
                  href={client.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variants={fadeUpVariants}
                  className="glass-card p-6 group flex flex-col gap-4"
                  style={{ background: 'rgba(0,0,0,0.025)' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
                      style={{ background: client.bg, color: client.color, border: `1px solid ${client.color}20` }}>
                      {client.initials}
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#aaaaaa] group-hover:text-[#b5915a] transition-colors duration-200 mt-1" />
                  </div>
                  <div>
                    <h3 className="text-[#0a0a0a] font-semibold text-base leading-tight mb-0.5">{client.name}</h3>
                    <p className="text-[#777777] text-xs">{client.location}</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl w-fit" style={{ background: SERVICE_COLORS[client.serviceType] }}>
                    <ServiceIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: SERVICE_TEXT_COLORS[client.serviceType] }} />
                    <span className="text-xs font-semibold" style={{ color: SERVICE_TEXT_COLORS[client.serviceType] }}>{client.service}</span>
                  </div>
                </motion.a>
              )
            })}
          </motion.div>
          <p className="text-[#999999] text-sm text-center font-medium mt-6">More clients joining →</p>
        </div>
      </section>

      {/* ── Industries ── */}
      <section className="section-padding bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={viewportConfig} className="text-center mb-14">
            <span className="bronze-label">Industries</span>
            <h2 className="section-title mt-4">Sectors We Serve</h2>
            <p className="text-[#666666] mt-3 max-w-xl mx-auto text-base leading-relaxed">
              Deep domain knowledge across eight critical industries.
            </p>
          </motion.div>
          <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={viewportConfig} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {INDUSTRIES.map(({ icon: Icon, title, desc, count }) => (
              <motion.div key={title} variants={fadeUpVariants} className="glass-card p-5 industry-card">
                <div className="w-10 h-10 rounded-xl bg-[#b5915a]/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[#b5915a]" />
                </div>
                <h3 className="text-[#0a0a0a] font-semibold text-sm mb-2">{title}</h3>
                <p className="text-[#777777] text-xs leading-relaxed mb-3">{desc}</p>
                <span className="text-xs text-[#b5915a]/70 font-medium">{count}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

    </div>
  )
}
