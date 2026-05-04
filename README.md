# Retro Fantasy Football

Retro Fantasy Football is a web-based fantasy football platform built with Vite, React, React Router, Tailwind CSS, shadcn-style UI components, TanStack Query, and Supabase.

## What This App Provides

- League discovery, creation, and commissioner management.
- Public and private leagues with member tracking.
- Team profile and roster editing flows.
- Player pool browsing with position filters, search, pagination, and historical scoring fields.
- League standings, matchup, scoring, roster, draft, AI-team, and data-import admin surfaces.
- Supabase repositories for users, leagues, league members, seasons, weeks, matchups, players, drafts, rosters, standings, import jobs, official leagues, and randomized-week support tables.
- League modes for `traditional` and `weekly_redraft`.
- Hidden per-player randomized week assignments based on one completed NFL source season.
- PWA scaffolding for installable/mobile-friendly delivery.

## Running The App

Copy `.env.example` to `.env` and add your Supabase project values. Supabase is required; the app does not include a local data adapter.

```bash
npm install
npm run dev
```

## Building The App

```bash
npm run build
```

## Supabase

- SQL migrations live in `supabase/migrations`.
- Edge functions live in `supabase/functions`, including:
  - `create_league`
  - `start_season`
  - `open_week_draft`
  - `submit_pick`
  - `finalize_lineup`
  - `resolve_week`
  - `advance_week`
  - `reveal_week_results`
  - `recalculate_standings`

The frontend routes auth, storage, data access, RPC calls, and Edge Function calls through `src/api/appClient.js`, backed by Supabase only.
