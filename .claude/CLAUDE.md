# 77STF — System Wewnętrzny

## Tożsamość
Zewnętrzny dział tech dla polskich MŚP (10-50 osób). Automatyzacje AI, głos AI, social media automation, content z drona.
Leady: **Avvlo** (farmacja, Michał Szarycz — aktywny, audyt po świętach), **Petro-Lawa** (paliwo), **Lead #3** (kolega Michała).

## Stack
- Frontend: Next.js 16 App Router, TypeScript strict, Tailwind v4, shadcn/ui (Radix)
- Backend: Supabase (PostgreSQL + RLS) | AI: Claude API (`lib/ai-config.ts`) | Email: Resend
- Głos AI: Vapi.ai + ElevenLabs | RPA: Playwright | Transkrypcja: Fireflies.ai
- Automatyzacje: n8n (Hetzner VPS — do kupienia) | Deploy: Vercel + Hetzner
- Integracje MCP: Gmail, Google Calendar, Notion, Canva — aktywne w każdej sesji

## Aktualny status systemu (03.04.2026)

### ✅ ZBUDOWANE I DZIAŁAJĄCE
- **CRM Core** — clients CRUD, notes CRUD, edit modal, status pipeline
- **Quote Builder** — wyceny z pozycjami, statusy, stats
- **Tasks** — zadania z priorytetami, deadlines, klientem
- **Audit Wizard** — 29 pytań, 6 kategorii, Strefa Konsultanta, ROI pricing, Audit→Quote
- **AI Meeting Brief** — Sonnet + CoT, dane z audytu injected
- **Notes Ingest** — raw text → struktury (Haiku)
- **Error Observatory** — logi błędów, admin-only DELETE
- **AI Cost Tracking** — projekcja, per-client, budget alert, trend 30 dni
- **Stack Intelligence** — React Flow per-klient, stack_items DB, CRUD
- **Google OAuth + Magic Link** — login bez hasła, /auth/callback
- **Intelligence Hub** — Command Center, Global Stack Map, Content Scout (live Sonnet), World Radar (live HN+CoinGecko)
- **Guardian Agent 2.0** — 5 reguł monitoring, Haiku summary, historia raportów
- **Agent Operator** — chat + tool use (8 narzędzi CRM), agentic loop — WYMAGA kontekstu systemu
- **Content Studio** — kanban postów, AI Ideas (Sonnet), filtr platformy
- **System Map** — interaktywna React Flow mapa całej architektury
- **Settings** — status env vars, konto, MCP, pending migracje
- **Slack Events API** — signature verification, async CRM ingest
- **Security** — RLS na wszystkich tabelach (012), rate limiting, Zod, CSP

### ⏳ MIGRACJE DO URUCHOMIENIA
| Plik | Co | Priorytet |
|------|----|-----------|
| 005_ai_usage_log_extended.sql | +stop_reason, response_time_ms, cache_tokens | WYSOKI |
| 006_lifecycle_and_attribution.sql | +created_by, lifecycle dates | ŚREDNI |
| 007_audit_context.sql | +context_data, implementations, financial_summary | WYSOKI |
| 009_intelligence_digests.sql | World Radar historia | WYSOKI |
| 010_guardian.sql | Guardian historia raportów | WYSOKI |
| 011_content_posts.sql | Content Studio | WYSOKI |
| 012_rls_security_fix.sql | SECURITY FIX — RLS dla clients, error_log, ai_usage_log | KRYTYCZNY |

### 🔲 DO ZBUDOWANIA (priorytet)
- **Client Portal** `/portal` — strona klienta (Magic Link auth), panel wdrożeń, status, documents — BRAK (404)
- **Agent Operator 2.0** — inject systemu context (CLAUDE.md + snapshot) do systemu promptu
- **System Snapshot API** — `/api/system/snapshot` → JSON pełnego stanu systemu dla agentów
- **WhatsApp → CRM** — Twilio/Meta webhook → ingest notatek
- **n8n workflows** — World Radar cron, Slack → CRM, Guardian auto-run

### Env vars wymagane
```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAILS=
AI_MONTHLY_BUDGET_USD=50
USD_PLN_RATE=4.0
N8N_WEBHOOK_SECRET=          # gdy kupisz n8n
SLACK_SIGNING_SECRET=        # Slack Events API
SLACK_WEBHOOK_URL=           # Slack Incoming Webhook
SLACK_CHANNELS=              # ID kanałów do nasłuchiwania
RESEND_API_KEY=              # email
```

---

## AGENT PERSONAS

### 🔬 Radar — Chief Intelligence Officer
**Zakres:** World news, AI trends, crypto, business intelligence
**Model:** Sonnet (digest) + Haiku (filtering)
**Output format:** source + credibility score + implikacje dla 77STF
**Forbidden:** Spekulacje bez źródła. Polityczne komentarze.
**Dostęp:** `/dashboard/intelligence` → Radar tab, `/api/intelligence/radar/run`

### 🎬 Scout — Content Analyst
**Zakres:** Analiza URL/tekstu/transkryptów → wartość biznesowa dla 77STF
**Model:** Sonnet
**Output:** zawsze kończy BUILD | UPGRADE_AGENT | ADD_TO_ROADMAP | SKIP | MONITOR
**Forbidden:** "może warto rozważyć" — zawsze konkretna decyzja.
**Dostęp:** `/dashboard/intelligence` → Content Scout, `/api/intelligence/analyze`

### 🏗️ Architect — Solutions Architect
**Zakres:** Stack wdrożeń dla klientów, ROI kalkulacje, audit analysis
**Model:** Sonnet
**Output:** operuje liczbami (PLN, ROI, payback months). Business-first.
**Forbidden:** Wdrożenia bez ROI. Feature bez uzasadnienia klienta.

### 🎯 Hunter — Business Development
**Zakres:** Lead research, scoring, cold outreach
**Model:** Haiku (scoring) + Sonnet (pitch)
**Forbidden:** Wysyła cokolwiek BEZ zatwierdzenia właściciela.

### 🛡️ Guardian — System Reliability & Action Advisor
**Zakres:** Monitoring systemu + proaktywne alerty + gotowe plany działania dla każdego problemu
**Model:** Haiku (summary) + Sonnet (rekomendacje)
**Zachowanie:** Każdy alert ma `action_type` (crm/code/config/manual) i opcjonalny `recommend_prompt`.
  - `crm` → przycisk "Otwórz profil klienta"
  - `code/config` → przycisk "Jak to naprawić?" → Sonnet generuje krok-po-kroku plan
  - Teksty zawsze po ludzku — dla właściciela firmy, nie technika
**Endpoints:** `/dashboard/guardian`, `/api/guardian/run`, `/api/guardian/recommend`

### 💬 Personal Assistant — Life & Business Organizer
**Zakres:** Slack notatki → CRM, Google Calendar, daily brief
**Model:** Haiku (ingest) + Sonnet (brief)
**Forbidden:** Nie interpretuje nadmiernie. Niepewny → pyta.
**Dostęp:** `/api/webhooks/slack-events`, Gmail MCP, Calendar MCP

### 🤖 Operator — System Controller
**Zakres:** Naturalny język → akcje na CRM (8 narzędzi: klienci, zadania, notatki, statystyki)
**Model:** Sonnet + tool use (agentic loop max 5 iteracji)
**PROBLEM:** Nie ma kontekstu systemu — nie wie o plikach, roadmapie, architekturze.
**FIX:** Inject system snapshot + CLAUDE.md summary do system prompt przy każdym wywołaniu.
**Dostęp:** `/dashboard/operator`, `/api/operator/chat`

---

## Agent Routing

| Intencja | Akcja |
|----------|-------|
| Buduj funkcję / etap | Plan → implementacja bezpośrednia |
| Szukanie w codebase (>3 pliki) | `Agent(Explore)` |
| Szukanie w ≤3 plikach | `Grep`/`Read` |
| Jasny błąd | Czytaj error → fix — BEZ agenta |
| Analiza bezpieczeństwa | agent: `sc-security-engineer` |
| Performance | agent: `sc-performance-engineer` |
| Refactoring | agent: `sc-refactoring-expert` |
| React bugs | agent: `react-expert` |
| TypeScript errors | agent: `typescript-expert` |
| Brief klienta | `/api/clients/[id]/meeting-prep` |
| Koszty AI | `/dashboard/ai-costs` |
| Analiza treści | Scout → `/dashboard/intelligence` |
| World news | Radar → `/dashboard/intelligence` |
| Slack notatka | PA → Slack → `/api/webhooks/slack-events` |
| System check | Guardian → `/dashboard/guardian` |
| CRM naturalny język | Operator → `/dashboard/operator` |

---

## Design: Carbon Pro
- Tokeny: `import { t } from '@/lib/tokens'` — ZAWSZE, nigdy hardcode hex
- Formattery: `import { formatPLN, formatDate, relativeTime } from '@/lib/format'`
- Animacje: CSS `@keyframes` — NIE framer-motion (USUNIĘTY permanentnie)
- Gold `#C49A2E` — TYLKO logo 77STF, Revenue KPI, główny CTA
- Język UI: **polski** | zmienne/komentarze/pliki: **angielski**

## Zasady kodu (OBOWIĄZKOWE)
- `createSupabaseServerClient()` → Server Components / Route Handlers
- `createSupabaseAdminClient()` → TYLKO `app/api/` (bypasses RLS)
- Auth w każdym API route: `const { data: { user } } = await authClient.auth.getUser()`
- Rate limiting: `rateLimit()` z `lib/rate-limit.ts` na AI endpoints
- Zod validation na wszystkich POST routes: `lib/validation.ts`
- Każde wywołanie AI → `callClaude()` z `lib/claude.ts`
- Error messages do klienta: ZAWSZE generyczne — detale do error_log
- Build MUSI być zielony przed zakończeniem etapu
- RLS na każdej nowej tabeli — ZAWSZE

## Komendy
```bash
npm run dev      # http://localhost:3000
npm run build    # weryfikacja TypeScript + build
claude-monitor   # burn rate tokenów
```

## Zainstalowane narzędzia
- **claudekit**: TypeScript BLOCKING hook, 14 subagentów
- **SuperClaude**: sc-analyze, sc-implement, sc-improve, sc-research, sc-troubleshoot, sc-test, sc-cleanup
- **RIPER-5**: structured workflow R→I→P→E→R
- **MCP aktywne:** Gmail, Google Calendar, Notion, Canva
- **MCP do dodania (priorytet):** Slack MCP (`claude mcp add slack`), Perplexity MCP (live web research dla Scout)

## Roadmap — DWIE ŚCIEŻKI

### 🏗 ŚCIEŻKA SYSTEMOWA

**✅ DONE (04.04.2026)**
CRM | Audyty | Wyceny | AI Brief | Stack Intelligence | Intelligence Hub | Guardian | Operator 2.0 | Content Studio | System Map | Security RLS | System Snapshot API | Client Portal

**🔥 TIER 1 — Natychmiastowe (2-4h każde)**
- **5i — Slack LIVE:** skonfiguruj SLACK_SIGNING_SECRET + SLACK_WEBHOOK_URL + auto-Calendar events
- **5j — Neuro-Content Upgrade:** engagement score, neuro-optimized hooks (TRIBE V2 principles), Meta/LinkedIn links
- **5k — Fireflies Webhook:** `POST /api/webhooks/fireflies` → auto-ingest transkryptów spotkań → CRM notes + tasks
- **5l — WhatsApp → CRM:** Meta Business API webhook → `POST /api/webhooks/whatsapp`

**🏗 TIER 2 — System Intelligence (tydzień 2)**
- **6 — Client Health Score:** AI churn risk score, upsell opportunities, inactive alerts per klient
- **7 — Revenue Intelligence:** pipeline value, MRR forecast, conversion rates w dashboard
- **8 — Email Automation:** quote follow-up (7 dni), onboarding sequence, Guardian alerts (Resend)

**🚀 TIER 3 — Self-Improving (tydzień 3-4)**
- **9 — Multi-Agent Pipeline:** trigger nowy klient → Scout research + Architect stack + Hunter email — wszystko auto
- **10 — Memory & Learning:** zaakceptowane wyceny enrichują pricing DB, audyty budują client archetypes
- **11 — Audit Wizard v2:** dodaj sekcję "Kontekst Biznesowy" (People/HR, Finance visibility, Competitive landscape)

**🛸 TIER 4 — Enterprise (miesiąc 2+)**
- **12 — Competitive Intelligence:** Perplexity MCP → monitor konkurencji klientów weekly
- **13 — Auto-Reporting:** miesięczny PDF dla klienta (wdrożenia, oszczędności, plan) → Resend
- **14 — n8n Orchestration:** po zakupie — social auto-post, Guardian/Radar cron, invoice automation
- **15 — Voice Agent Demo:** Vapi.ai + ElevenLabs → demo URL dla klientów na spotkaniach

### 🎯 ŚCIEŻKA KLIENCKA (tylko gdy user mówi "klienci/demo/Avvlo")
Voice Agent DEMO (Vapi+ElevenLabs) | Opinion AI (Google Maps/Ceneo) | Smart Chatbot RAG | Social Media Auto | CEO Reports

## n8n — priorytetowe workflows (po zakupie)
Gotowe endpointy w naszym API czekają na n8n jako trigger:
- `slack-to-crm` → `/api/webhooks/slack-ingest` ✅
- `cron-guardian` (8:00) → `/api/guardian/run` ✅
- `cron-radar` (7:00) → `/api/intelligence/radar/run` ✅
- `whatsapp-to-crm` → `/api/webhooks/whatsapp` (do zbudowania)
- `fireflies-transcript` → `/api/webhooks/fireflies` (do zbudowania)
- `linkedin-lead-capture` → `/api/clients` ✅
- `quote-follow-up` (7d) → Resend + `/api/quotes` ✅
- `social-auto-post` → Meta/LinkedIn API (Etap 5j)
- `google-reviews-monitor` → AI response draft → email (Etap 12)

---

## OBOWIĄZKOWY STATUS BLOCK

Po każdym ukończonym etapie ZAWSZE kończ odpowiedź:

```
---
📍 **Etap:** [nazwa]
✅ **Zrobione:** [co konkretnie]
🔥 **Następny:** [co dalej]
📋 **Roadmap:** [aktualny stan]
```
