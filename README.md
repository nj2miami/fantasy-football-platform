# Retro Fantasy Football

Retro Fantasy Football is a web-based fantasy football platform built with Vite, React, React Router, Tailwind CSS, shadcn-style UI components, TanStack Query, and a Supabase-oriented data layer.

## What This App Provides

- League discovery, creation, and commissioner management.
- Public and private leagues with member tracking.
- Team profile and roster editing flows.
- Player pool browsing with position filters, search, pagination, and historical scoring fields.
- League standings, matchup, scoring, roster, draft, AI-team, and data-import admin surfaces.
- Supabase-oriented repositories for users, leagues, league members, seasons, weeks, matchups, players, drafts, rosters, standings, import jobs, official leagues, and randomized-week support tables.
- League modes for `traditional` and `weekly_redraft`.
- Hidden per-player randomized week assignments based on one completed NFL source season.
- PWA scaffolding for installable/mobile-friendly delivery.

## Running The App

Copy `.env.example` to `.env` and add your Supabase project values. If no Supabase env vars are present, the app falls back to a demo adapter so the UI can still be explored locally.

```bash
npm install
npm run dev
```

## Building The App

```bash
npm run build
```

## Supabase Scaffolding

- SQL schema scaffold: `supabase/migrations/20260423_randomized_historical_framework.sql`
- Edge function stubs:
  - `create_league`
  - `start_season`
  - `open_week_draft`
  - `submit_pick`
  - `finalize_lineup`
  - `resolve_week`
  - `advance_week`
  - `reveal_week_results`
  - `recalculate_standings`

The frontend now routes auth and data access through `src/api/appClient.js`, which prefers Supabase when configured and uses a demo adapter as a development fallback.
