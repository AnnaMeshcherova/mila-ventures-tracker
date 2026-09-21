@AGENTS.md

# Mila Ventures Weekly Update Tracker

Internal web app for tracking weekly team updates. Next.js 16 (App Router) + Supabase + Tailwind CSS + shadcn/ui.

Note: `params` and `searchParams` are Promises in Next.js 16 and must be awaited.
The Next.js 14 synchronous signatures will fail the build.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Architecture
- Pages are Client Components ("use client") that query Supabase from the browser
  and rely on RLS for authorization. `/submit` is the one exception: a Server
  Component that redirects.
- Auth is enforced by `middleware.ts` before any page renders — pages do not need
  their own auth checks.
- Shared helpers live in `lib/utils.ts` (`cn`, `getInitials`). Don't re-declare them per file.
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
