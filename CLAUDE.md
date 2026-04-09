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
