@AGENTS.md

# Mila Ventures Weekly Update Tracker

Internal web app for tracking weekly team updates. Next.js 14 (App Router) + Supabase + Tailwind CSS + shadcn/ui.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Architecture
- Server Components for pages (dashboard, history, profile)
- Client Components for interactive pieces (UpdateForm, SearchBar, WeekSelector, NavBar)
- `lib/supabase.ts` — browser client (createClient)
- `lib/supabase-server.ts` — server client (createServerSupabaseClient)
- Middleware uses `getUser()` not `getSession()` per Supabase App Router docs

## Database
- Supabase PostgreSQL with RLS
- Profiles + weekly_updates tables
- Drafts only visible to author via RLS policy
- search_updates RPC for full-text search

## Project Glossary
Used by the AI overview to correctly group themes and avoid hallucinating connections.
Injected into the LLM prompt for theme extraction. Update this when new projects start.

- **VSB** = Venture Studio Bootcamp. Also referred to as "bootcamp". A program for aspiring founders. VSB and bootcamp are the SAME thing — always group together.
- **macle.ai** = AI tool for generating venture memos and trend forecasts. Also related to researcher recruitment (identifies research talent through the venture pipeline).
- **FIR** = Founder in Residence program. Involves selection committee, onboarding, contracts, pipeline management.
- **Mila Ventures Tracker** = This app. The internal info-sharing tool for weekly team updates. Built by Anna. Used for team meeting management. NOT for finding researchers.
- **LaserShark** = Portfolio company.
- **Sandbox AI** = Portfolio company.
- **Novalytics** = Portfolio company.
- **Chrysalabs** = Portfolio company.
- **OKRs** = Objectives and Key Results (quarterly planning).
