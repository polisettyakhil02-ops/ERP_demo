import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HiveErpPlaceholder from '@/components/sections/HiveErpPlaceholder'

export const metadata: Metadata = {
  title: 'HIVE ERP — School Management System | Dominare Tech',
  description: 'HIVE ERP is Dominare Tech\'s purpose-built school management system. Admissions, fees, attendance, timetable, parent portal and more — all in one platform.',
}

export default function HiveErpPage() {
  return (
    <main>
      <Navbar />
      <HiveErpPlaceholder />
      <Footer />
    </main>
  )
}
