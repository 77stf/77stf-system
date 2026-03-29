# 77STF — System Wewnętrzny

## Kim jest 77STF
Zewnętrzny dział technologiczny dla polskich firm MŚP (10-50 osób).
Budujemy automatyzacje AI, głos AI, social media automation i content z drona.
Jesteśmy częścią firmy klienta — bez etatu. Znamy ich systemy, proponujemy
ulepszenia zanim klient to zauważy.

## Stack techniczny
- Frontend: Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui (Radix)
- Backend: Supabase (PostgreSQL) z RLS
- Automatyzacje: n8n self-hosted na Hetzner VPS
- AI: Claude API (główny), GPT-4o (fallback przy dużym wolumenie)
- Głos AI: Vapi.ai + ElevenLabs (klonowanie głosu)
- RPA: Playwright + PyAutoGUI + Anthropic Computer Use
- OCR: Google Document AI
- Transkrypcja: Fireflies.ai
- Email: Resend
- Deploy: Vercel (frontend) + Hetzner VPS (n8n)

## Usługi które oferujemy
1. Automatyzacja procesów operacyjnych (4-25k PLN setup)
2. Asystent głosowy AI infolinia 24/7 (3-8k setup + 800-2000/mies)
3. Automatyzacja social mediów z realnego contentu (2-4k setup + 1-2.5k/mies)
4. Content z drona — Poznań i okolice (2-3k per sesja)
5. Partnerstwo miesięczne (1.5-3.5k/mies per klient)

## Docelowi klienci
- Firmy 10-50 osób, właściciel decyduje sam, brak działu IT
- Branże priorytetowe: transport/paliwo, farmacja, rolnictwo, budownictwo
- Firmy w pipeline:
  - **Avvlo (Instytut Farmaceutyczny)** — AKTYWNY LEAD, call 27.03 ✓, Michał Szarycz (CEO), instytut@avvlo.pl
  - **Petro-Lawa Sp. z o.o.** — LEAD, oferta wysłana 14.03, odpowiedź chłodna, Sławomir Pałka (Dyrektor)
  - **Lead #3** — kolega Michała z Avvlo, ta sama branża farmaceutyczna, pozyskany 27.03

## Co odróżnia nas od konkurencji
- Wchodzimy w stary system ERP bez API przez RPA
- Głos AI z prawdziwym sklonowanym głosem osoby z firmy klienta
- Panel klienta gdzie sam widzi wartość automatyzacji w czasie rzeczywistym
- Guardian Agent — sami proponujemy ulepszenia zanim klient zauważy problem

## Design systemu — "Carbon Pro" (aktualny)
- Styl: premium dark SaaS — ciemno-szary #111114 (nie czerń), czysta biała hierarchia tekstu
- Tło strony: #111114, sidebar: #080811, karty: rgba(255,255,255,0.025) bg
- Złoty akcent #C49A2E — TYLKO logo 77STF, Revenue KPI, główny CTA button (brand element)
- Semantic colors: green=success, red=error, amber=warning — inline, nie tokeny
- Tokeny: `import { t } from '@/lib/tokens'` — ZAWSZE używaj, nigdy hardcode hex
- Formatery: `import { formatPLN, formatDate, relativeTime } from '@/lib/format'`
- ReactBits: SpotlightCard (cursor tracking, ResizeObserver), AnimatedCounter (count-up)
- Animacje: CSS `@keyframes` (cardEnter, fadeSlide, progressExpand, pageFadeIn) — NIE framer-motion
- framer-motion USUNIĘTY ze wszystkich komponentów (powodował "Router action dispatched" error)
- Sidebar nav-pill: CSS transition top/height (nie framer-motion spring)
- backdropFilter USUNIĘTY z sidebar i stats-bar (powodował lag GPU)
- Język UI: polski | Zmienne/komentarze: angielski

## Struktura aplikacji
- app/dashboard/ — widok właściciela firmy (chroniony Supabase Auth)
- app/portal/ — widok klienta (Supabase Auth magic link — NIE publiczny token!)
- app/login/ — logowanie dla admina/pracowników (email + hasło)
- app/api/ — API routes, webhooki (Fireflies, n8n)
- components/ui/ — SpotlightCard, AnimatedCounter, CommandPalette, PageTransition, Skeleton
- components/dashboard/ — Sidebar, TopBar, StatsBar, RevenueChart, PipelineSummary, ClientsTable
- lib/supabase.ts — klient Supabase (SSR + admin)
- lib/claude.ts — wrapper Claude API
- lib/types.ts — typy TypeScript
- lib/tokens.ts — design tokens (t.text.primary, t.brand.gold itd.)
- lib/format.ts — formatPLN, formatDate, relativeTime, getInitials
- lib/ai-config.ts — centralne zarządzanie modelami AI (fast/balanced/powerful per feature)
- lib/audit-questions.ts — bank pytań audytowych
- middleware.ts — ochrona /dashboard/** i /portal/**

## Tabele Supabase (istniejące)
- clients — klienci firmy (status: lead/active/partner/closed)
- projects — projekty per klient (status: kickoff/demo1/demo2/production/delivered)
- automations — automatyzacje klientów z pingiem i licznikami
- meetings — transkrypty i analiza AI spotkań
- documents — oferty, umowy, raporty (generowane automatycznie)
- leads — leady sprzedażowe
- monthly_reports — raporty miesięczne per klient
- guardian_reports — raporty Guardian Agenta
- referrals — program poleceń (10% przez 12 miesięcy)
- error_log — logi błędów automatyzacji

## Tabele Supabase (planowane)
- user_roles — role pracowników: owner/partner/employee
- client_contacts — kontakty klientów z dostępem do portalu (Supabase Auth, magic link)
- audit_log — kto co kiedy oglądał/zmieniał (GDPR)
- stack_items — narzędzia/integracje per klient (Stack Intelligence)
- stack_connections — połączenia między narzędziami (edges grafu)
- tech_discoveries — odkrycia AI Discovery Agenta
- implementation_templates — szablony wdrożeń
- system_prompts — wersje promptów Guardian Agent 2.0
- reflection_logs — logi ewaluacji AI Judge
- suggestions — sugestie poniżej progu zmiany

## Zasady pracy z Claude Code

### Sposób działania (OBOWIĄZKOWY)
1. **Planuj przed działaniem** — zanim napiszesz kod, opisz podejście w 2-3 zdaniach. Jeśli coś idzie nie tak, zatrzymaj się i zaplanuj od nowa zamiast iść dalej złą drogą.
2. **Używaj subagentów do researchu** — długie przeszukiwania codebase deleguj do agenta Explore/general-purpose, żeby nie zaśmiecać głównego kontekstu.
3. **Tryb samodoskonalenia** — po każdej korekcie od właściciela aktualizuj CLAUDE.md (sekcja Zasady lub feedback memory), żeby nie popełniać tego samego błędu dwa razy.
4. **Weryfikacja przed ukończeniem** — nigdy nie oznaczaj etapu jako gotowy bez uruchomienia `npm run build`. Jeśli build fail → napraw, nie pokazuj.

### Test checklist po każdym etapie (OBOWIĄZKOWY)
Po zakończeniu każdego etapu podaj użytkownikowi listę kroków do przetestowania w formie:
```
**Test checklist — Etap X:**
1. Otwórz [url/widok]
2. Sprawdź czy [konkretna funkcja] działa
3. Przetestuj [edge case]
4. Jeśli masz błąd [komunikat], sprawdź [gdzie]
```
Bez tej listy etap NIE jest ukończony.

### Inne zasady
- Zawsze uruchom build i sprawdź błędy zanim pokażesz wynik
- Nigdy nie commituj do main bezpośrednio
- Jeden cel na sesję
- Po każdej sesji zaktualizuj sekcję "Aktualny status"
- Używaj createSupabaseServerClient (SSR) w Server Components
- Używaj createSupabaseAdminClient w API routes

## Roadmap etapów — stan na 2026-03-29

### ✅ Ukończone
- Etap 1: Supabase tabele + lib (supabase, types, claude)
- Etap 2–2h: Dashboard design system "Carbon Pro" — iteracje od Obsidian → Pearl → Void → Carbon
- Etap 2f: UX polish — ⌘K Command Palette, loading skeletons, PageTransition (CSS, nie framer-motion)
- Etap 3: Widok klienta /dashboard/clients/[id] — hero card, projekty, automatyzacje
- Etap 4: Auth — middleware + /login + sidebar z sesją + add-client modal
- Etap 5c: Quote Builder — /dashboard/quotes + /api/quotes
- Etap 5d: Zadania — /dashboard/tasks + /api/tasks
- Etap 5e: Audit Toolkit — /dashboard/clients/[id]/audit + /dashboard/audits
- Etap 5f: Smart Notes Ingest — /api/clients/[id]/ingest
- Etap 5g: AI Meeting Brief + Error Observatory:
  - /dashboard/clients/[id]/prep — glass panels brief UI, BriefError z realnym błędem
  - /dashboard/errors — panel logów z kopiowaniem, expandable metadata
  - /api/clients/[id]/meeting-prep — Sonnet model, _scratchpad CoT, prompt v3
  - /api/errors — GET + DELETE error_log
  - Performance fix: framer-motion usunięty z 5 komponentów → CSS animations
  - Bug fix: "Router action dispatched before initialization" → gone
  - Bug fix: JSON truncation → strict limits + max_tokens 4096

### 🔧 Backlog techniczny
- Migracja 003_error_log.sql — uruchom w Supabase SQL Editor jeśli nie zrobione
- Zod validation w API routes
- Portal klienta — magic link auth (Supabase Auth, nie token w URL)
- client_notes tabela — migracja 001 musi być uruchomiona

### 🚀 Kolejne etapy (priorytet ↓)
- **Etap 6c: Voice Agent DEMO** — Vapi.ai + ElevenLabs (PRIORYTET dla Avvlo — demo dla Michała)
- Etap 4b: Google Login (Supabase OAuth) + Settings Page
- Etap 5a: Stack Intelligence — React Flow graph narzędzi per klient
- Etap 5b: Claude Cost Tracking — ai_usage_log + /dashboard/ai-costs
- Etap 6b: LeadGen System — Apify + Claude + leads scoring
- Etap 7: Research Scout — n8n cron + tech_discoveries
- Etap 7b: Smart Chatbot RAG — baza dokumentów dla Avvlo
- Etap 8: Content Scout — video URL → AI analysis → build/skip
- Etap 9: Improvements Panel — Guardian Agent suggestions z ROI
- Etap 9b: Opinion Response AI — scraping + odpowiadanie na opinie
- Etap 10: Guardian Agent 2.0 — AI Judge + self-improving prompts
- Etap 11: Agent Operator — chat + MCP Gmail/Calendar/Notion

### 📋 Strony istniejące (z kodem)
/dashboard, /dashboard/clients, /dashboard/clients/[id], /dashboard/clients/[id]/prep,
/dashboard/clients/[id]/audit, /dashboard/quotes, /dashboard/tasks, /dashboard/audits,
/dashboard/errors, /dashboard/projects*, /dashboard/documents*, /dashboard/guardian*,
/dashboard/settings*, /login (* = placeholder "W budowie")

## Stack Intelligence Panel (planowane — Etap 5-8)
Visual tree każdego wdrożenia per klient + AI agent monitorujący nowe technologie.
- Każdy klient ma interaktywny graph (React Flow): nodes = narzędzia, edges = przepływ danych
- Tech Radar: AI Discovery Agent skanuje co 24h nowe wersje, lepsze narzędzia, optymalizacje
- Implementation Templates: biblioteka gotowych schematów wdrożeń
- Rozszerzenie Guardian Agenta → Guardian Agent 3.0
- Szczegóły w memory: project_stack_intelligence.md

## Agent Operator (w budowie)
Prawa ręka firmy — agent AI który:
- Zna wszystkie transkrypty spotkań z klientami
- Ma dostęp do Notion (MCP), Gmail (MCP), Google Calendar (MCP)
- Pomaga przygotować się do spotkań, analizuje rozmowy, sugeruje następne kroki
- Docelowo: steruje zadaniami, przypomina o obietnicach, wykrywa ryzyka

## Self-Improving AI — wzorzec do wdrożenia (Guardian Agent 2.0)
Znalezisko z YouTube (2026-03-24). Wzorzec samodoskonalącego się systemu AI.

### Jak działa
- Chatbot główny + oddzielny **AI Judge** (LLM-as-judge) który czyta rozmowy
- Judge ocenia jakość wg rubryku punktowego (1-5): kompletność, głębokość, ton, zakres
- Jeśli wynik poniżej progu → automatyczna aktualizacja system promptu
- Pełna historia wersji promptów + możliwość rewertu
- Cooldown period po każdej aktualizacji (ochrona przed niestabilnością)
- Panel admin: logi refleksji, sugestie, ustawienia progu i interwału

### Nowe tabele Supabase (gdy będziemy wdrażać)
- `system_prompts` — wersje promptów z historią
- `reflection_logs` — logi każdej ewaluacji AI Judge
- `suggestions` — sugestie poniżej progu zmiany (do ręcznego przeglądu)

### Gdzie zastosować w 77STF
1. **Guardian Agent** — Judge ocenia jakość guardian_reports
2. **Agent Operator** — chatbot wewnętrzny sam się poprawia na podstawie rozmów z właścicielem
3. **Chatboty dla klientów** — możliwa usługa premium dla klientów MŚP

### Status
Nie zaczęty. Priorytet: po ukończeniu Etapu 3. Szczegóły w memory: `project_self_improving_system.md`

## AI Meeting Brief — architektura (Etap 5g)
- Model: claude-sonnet-4-6 (balanced) — świadomy wybór dla jakości polszczyzny (~3¢/brief)
- Prompt pattern: _scratchpad chain-of-thought → AI analizuje klienta przed generowaniem JSON
- Anti-pattern examples w prompcie: ✗ "Jaki integracja" → ✓ "Z jakiego systemu korzystacie?"
- Pola briefa: executive_summary (4-5 zdań), decision_maker_profile, conversation_tone,
  pain_points, opportunities, proposed_solutions (z ROI), questions_to_ask (otwarte),
  objections_to_handle, closing_strategy, next_steps
- max_tokens: 4096 (Sonnet jest zwięzły, ~1500 tokenów na brief), timeout: 90s
- Fallback: mock brief gdy brak ANTHROPIC_API_KEY
- Error log: każdy błąd → error_log table → /dashboard/errors

## Aktualny status — 2026-03-29

### Ukończone (najnowsze na górze)
- **Etap 5g ukończony** — AI Meeting Brief v2 + Performance + Error Observatory:
  - Brief: Sonnet model, _scratchpad CoT, anti-pattern prompt, 2 nowe pola (DM profile, tone)
  - Glass panels UI: GlassPanel, PanelLabel, ROI bar z gold gradient, timeline steps
  - BriefError: pokazuje realny błąd (nie "Tryb demo"), z hint (timeout/credit/auth)
  - /dashboard/errors: panel logów, copy-all button, expandable metadata
  - Performance: framer-motion usunięty z 5 komponentów → CSS keyframes
  - Bug fix: "Router action dispatched before initialization" → naprawiony
  - Bug fix: JSON truncation → naprawiony (strict limits + max_tokens 4096)
  - Build clean ✓

- **Etap 5f ukończony** — Smart Notes Ingest — /api/clients/[id]/ingest
- **Etap 5e ukończony** — Audit Toolkit — /dashboard/clients/[id]/audit + /dashboard/audits
- **Etap 5d ukończony** — Tasks (Zadania) — /dashboard/tasks + /api/tasks
- **Etap 5c ukończony** — Quote Builder — /dashboard/quotes + /api/quotes
- **Etap 4 ukończony** — middleware + /login + sidebar z sesją + add-client modal
- **Etap 3 ukończony** — widok klienta /dashboard/clients/[id]
- **Etap 2h ukończony** — "Carbon Pro" design system, tokens, formatters, build clean
- **Etap 1 ukończony** — Supabase + lib files

### Migracje SQL (Supabase SQL Editor)
Jeśli nie uruchomione:
- 001_quotes_tasks.sql — quotes, tasks, client_notes
- 002_audits.sql — audyty
- 003_error_log.sql — logi błędów (KRYTYCZNE)

### Następny priorytet
**Etap 6c: Voice Agent DEMO** dla Avvlo (Vapi.ai + ElevenLabs)
- Michał czeka na demo — to nasz priorytetowy deal
- Wymaga: konto Vapi.ai, klucz ElevenLabs, sklonowany głos próbny