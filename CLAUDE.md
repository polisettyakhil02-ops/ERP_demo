# Dominare Tech Pvt Ltd — Project Memory

## Company Info
- **Company:** Dominare Tech Pvt Ltd
- **Phone:** +91 8688361839
- **Email:** support@dominaretech.com
- **Address:** H. No. 6-3-1093/406, V V Vintage Boulevard, Somajiguda, Hyderabad, Telangana – 500082
- **LinkedIn:** https://www.linkedin.com/in/dominare-tech-a05b9a391/
- **WhatsApp:** https://wa.me/918688361839

## Tech Stack
- **Framework:** Next.js 15 (App Router), TypeScript strict
- **Styling:** Tailwind CSS v4 (`@import "tailwindcss"`, `@theme {}`)
- **Animation:** Framer Motion 11
- **Icons:** Lucide React
- **Font:** Inter (next/font/google)

## Design System
- **Theme:** Light — white backgrounds (`#ffffff`), dark text (`#0a0a0a`), bronze accent (`#9a7540` / `#b5915a`)
- **Cards:** `glass-card` utility — `rgba(0,0,0,0.03)` bg + `rgba(0,0,0,0.09)` border
- **Buttons:** `.btn-bronze` (bronze gradient, white text), `.btn-outline` (transparent, dark border)
- **Bronze accent rule:** Only on buttons, icons, borders on hover — never on headings or body text

## Pages
| Route | File | Status |
|---|---|---|
| `/` | `app/page.tsx` | Live — all sections |
| `/about` | `app/about/page.tsx` | Live |
| `/contact` | `app/contact/page.tsx` | Live |
| `/hive-erp` | `app/hive-erp/page.tsx` | Placeholder (coming soon) |

## Contact Form (2-step enquiry flow)
1. **Step 1:** Full Name + Purpose dropdown
   - Options: HIVE ERP, Vision Digital Boards, Software Solutions, Hardware & Infrastructure
2. **Step 2:** Pre-filled channel buttons
   - WhatsApp: `https://wa.me/918688361839?text=<encoded>`
   - Email: `mailto:support@dominaretech.com?subject=...&body=...`

## Services Offered
- Website Development
- Web App Development
- Android Applications
- E-commerce & Shopify
- Custom Software
- Hardware & Infrastructure
- Vision Digital Boards
- HIVE ERP (School Management System) — separate page `/hive-erp`

## Git
- **Repo:** `polisettyakhil02-ops/ERP_demo`
- **Branch:** `claude/dominare-tech-website-bimci2`
- **PR:** #2 (draft, open)

## Notes
- Client logos are styled initials badges — actual logo image files not yet provided
- HIVE ERP page is a placeholder; full design to be done later
- All 5 routes build statically with 0 TypeScript errors (`npm run build`)
