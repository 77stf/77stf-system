# 77STF — Master Status & Roadmap
**Ostatnia aktualizacja: 10.04.2026**
> Plik do ręcznej edycji podczas pracy offline. Przed kolejną sesją z Claude wyślij jako prompt korekcyjny.

---

## 1. TOŻSAMOŚĆ I KONTEKST BIZNESOWY

**77STF Operations** — zewnętrzny dział tech dla polskich MŚP (10-50 osób).
Usługi: automatyzacje AI, głos AI, social media automation, content z drona.

> ⚠️ UWAGA: Jest też **77STF Media** (zarządzanie OnlyFans) — ODDZIELNA firma, ODDZIELNY system. Nie mieszamy.

### Aktywne leady
| Klient | Kontakt | Status | Notatka |
|--------|---------|--------|---------|
| **Avvlo** | Michał Szarycz | 🔥 Gorący | Farmacja. Audyt po świętach. ~25 pracowników, 65k PLN/mies. utraconych leadów weekendowych. Call 27.03 — sukces, zaprosił kolegę (Lead #3) |
| **Petro-Lawa** | — | 🟡 Lead | Paliwo |
| **Lead #3** | Kolega Michała | 🟡 Lead | Znajomy z Avvlo |

---

## 2. STACK TECHNICZNY

| Warstwa | Technologia |
|---------|-------------|
| Frontend | Next.js 16 App Router, TypeScript strict, Tailwind v4, shadcn/ui (Radix) |
| Backend | Supabase (PostgreSQL + RLS) |
| AI | Claude API — Haiku (szybkie), Sonnet (złożone) |
| Email | Resend |
| Automatyzacje | n8n (Hetzner VPS) |
| Deploy | Vercel (frontend) + Railway (Telegram forwarder) |
| Monitoring | Telegram forwarder (13 kanałów) |
| Integracje MCP | Gmail, Google Calendar, Notion, Canva (aktywne w Claude Code) |

### Env vars — Vercel (co jest, czego brakuje)
| Zmienna | Status | Uwagi |
|---------|--------|-------|
| NEXT_PUBLIC_SUPABASE_URL | ✅ | |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ | |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | |
| ANTHROPIC_API_KEY | ✅ | |
| SLACK_SIGNING_SECRET | ✅ | Dodany |
| SLACK_BOT_TOKEN | ✅ | xoxb-... |
| SLACK_WEBHOOK_ALERTS | ✅ | |
| SLACK_WEBHOOK_BRIEF | ✅ | |
| SLACK_WEBHOOK_MEDIA | ✅ | |
| SLACK_WEBHOOK_CRM | ✅ | |
| SLACK_CHANNELS | ⚠️ | Placeholder — zmień na prawdziwe ID kanału #quick-notes |
| N8N_WEBHOOK_SECRET | ❓ | Sprawdź czy dodany |
| N8N_API_KEY | ❓ | Potrzebny do Control Center i sync.mjs |
| RESEND_API_KEY | ✅ | |
| RESEND_FROM_EMAIL | ❌ | Brakuje — blokuje quote follow-up emails |
| ADMIN_EMAILS | ❓ | Sprawdź |
| AI_MONTHLY_BUDGET_USD | ❓ | Sprawdź |
| USD_PLN_RATE | ❓ | Sprawdź |

---

## 3. INFRASTRUKTURA — AKTUALNY STAN

### Vercel
- URL produkcyjny: `https://77stf-system-crypto77stf-4430s-projects.vercel.app`
- Domena docelowa: `ds-ai.pl` (sprawdź status DNS — rekord A i CNAME dodane w home.pl)
- Auto-deploy: ✅ działa (disabled "Require Verified Commits")
- Build: ✅ zielony

### Supabase
- Project ref: `hfvekuikmljagdwowhak`
- Auth: Magic Link + Google OAuth (Site URL zaktualizowany na Vercel URL)
- guardian_reports: ✅ schema naprawiony (dodano kolumny alert_count, summary, alerts, etc. przez API)

### Railway
- Telegram forwarder: ✅ działa
- Auto-deploy: ✅ GitHub Actions (trigger: zmiany w `scripts/telegram-forwarder/**`)

### n8n
- Hosting: Hetzner VPS (n8n.socmid.cloud)
- API: `https://n8n.socmid.cloud/api/v1`
- 5 workflows zsynchronizowanych przez `node n8n-workflows/sync.mjs`

### GitHub
- Repo: `77stf/77stf-system`
- Branch główny: `main`
- CI: GitHub Actions (deploy forwarder na Railway)
- Push Protection: aktywne (Slack webhook URLs zastąpione SLACK_WEBHOOK_PLACEHOLDER w n8n JSONach)

---

## 4. BAZA DANYCH — MIGRACJE

| Plik | Zawartość | Status |
|------|-----------|--------|
| 001_quotes_tasks.sql | quotes, quote_items, tasks, client_notes + RLS | ✅ |
| 002_audits.sql | audits + RLS | ✅ |
| 003_error_log.sql | error_log | ✅ |
| 004_ai_usage_log.sql | ai_usage_log (bazowa) | ✅ |
| 005_ai_usage_log_extended.sql | +stop_reason, response_time_ms, cache_tokens | ⏳ URUCHOM |
| 006_lifecycle_and_attribution.sql | +created_by, lifecycle dates | ⏳ URUCHOM |
| 007_audit_context.sql | +context_data, implementations, financial_summary | ⏳ URUCHOM |
| 008_stack_items.sql | stack_items + RLS | ✅ |
| 009_intelligence_digests.sql | intelligence_digests (World Radar historia) | ⏳ URUCHOM |
| 010_guardian.sql | guardian_reports | ✅ (schema naprawiony przez ALTER TABLE) |
| 011_content_posts.sql | content_posts + RLS | ⏳ URUCHOM |
| 012_rls_security_fix.sql | **KRYTYCZNE** RLS dla clients, error_log, ai_usage_log | ⏳ URUCHOM TERAZ |
| 013_meeting_transcripts.sql | transkrypty spotkań (Fireflies) | 🔲 do stworzenia |

> **Uruchom 012 NATYCHMIAST** w Supabase SQL Editor — to security fix (RLS).

---

## 5. CO ZBUDOWALIŚMY — KOMPLETNA LISTA

### Nawigacja (sidebar)
Obecna struktura po cleanup (10.04.2026):
```
Główne:     Dashboard | Klienci | Zadania | Wyceny | Audyty
Agenci AI:  Operator | Guardian | Intelligence Hub
System:     Koszty AI | Logi błędów | Mapa systemu | Ustawienia
```

### Strony dashboard — stan 10.04.2026

| Strona | Status | Opis |
|--------|--------|------|
| `/dashboard` | ✅ | KPI, revenue chart, pipeline, red flags |
| `/dashboard/clients` | ✅ | Lista klientów + filtrowanie |
| `/dashboard/clients/[id]` | ✅ | Profil + edit modal + **delete button** (dodany 10.04) |
| `/dashboard/clients/[id]/prep` | ✅ | AI Meeting Brief v3 (Sonnet + CoT) |
| `/dashboard/clients/[id]/audit` | ✅ | Audit Wizard 29 pytań + ROI + CreateQuoteModal |
| `/dashboard/clients/[id]/stack` | ✅ | Stack Intelligence per-klient |
| `/dashboard/quotes` | ✅ | Quote Builder z pozycjami, statusy, stats |
| `/dashboard/tasks` | ✅ | Zadania z priorytetami i deadlines |
| `/dashboard/audits` | ✅ | Lista audytów + AI analiza |
| `/dashboard/errors` | ✅ | **Filtr 24h domyślnie** (naprawione 10.04) |
| `/dashboard/ai-costs` | ✅ | Koszty AI: projekcja, per-client, budget alert |
| `/dashboard/intelligence` | ✅ | Hub: Command Center + Stack Map + Scout + Radar |
| `/dashboard/guardian` | ✅ | Guardian 2.0: 5 reguł, historia raportów |
| `/dashboard/operator` | ✅ | Chat + 8 tool use (słaby context — patrz PROBLEMY) |
| `/dashboard/system-map` | ✅ | System Map: 3 taby — Mapa grid/Tech Stack/Agent API |
| `/dashboard/settings` | ✅ | Env status, Slack status, n8n, Control Center (10.04) |
| `/dashboard/telegram` | ✅ | Live feed Telegram (ale usunięty z sidebar — 77STF Media) |
| `/portal` | ✅ | Admin: lista portali klientów |
| `/portal/[clientId]` | ✅ | Panel klienta: KPI, stack, wyceny do zatwierdzenia |

### API routes — kompletna lista

| Route | Status |
|-------|--------|
| POST/GET/PATCH/DELETE `/api/clients` | ✅ |
| POST `/api/clients/[id]/ingest` | ✅ |
| GET `/api/clients/[id]/meeting-prep` | ✅ |
| POST/GET/PATCH/DELETE `/api/clients/[id]/notes` | ✅ |
| GET/POST/PATCH/DELETE `/api/clients/[id]/stack` | ✅ |
| POST `/api/audits` | ✅ |
| POST `/api/audits/[id]/analyze` | ✅ |
| POST `/api/audits/[id]/create-quote` | ✅ |
| CRUD `/api/quotes/[id]` | ✅ |
| CRUD `/api/tasks` | ✅ |
| GET `/api/ai-usage` | ✅ |
| GET/DELETE `/api/errors` | ✅ |
| POST `/api/intelligence/radar/run` | ✅ |
| GET `/api/intelligence/radar` | ✅ |
| POST `/api/intelligence/analyze` | ✅ |
| GET `/api/intelligence/stack` | ✅ |
| POST `/api/guardian/run` | ✅ |
| GET `/api/guardian` | ✅ |
| POST `/api/guardian/recommend` | ✅ |
| POST `/api/operator/chat` | ✅ (słaby context) |
| CRUD `/api/content/posts` | ✅ |
| GET `/api/system/snapshot` | ✅ |
| GET/PATCH `/api/system/toggles` | ✅ |
| POST `/api/webhooks/slack-events` | ✅ (kod gotowy) |
| POST `/api/webhooks/slack-ingest` | ✅ |
| POST `/api/webhooks/telegram` | ✅ |
| POST `/api/slack/commands` | ✅ (6 komend) |
| GET `/api/portal/[clientId]` | ✅ |
| POST `/api/portal/[clientId]/quotes/[quoteId]/accept` | ✅ |
| GET `/auth/callback` | ✅ |

### n8n Workflows — zsynchronizowane

| Plik | Workflow ID | Trigger | Status |
|------|-------------|---------|--------|
| 01-cron-guardian.json | 3sxJZEfC3U9BWEZu | Cron 08:00 | ✅ zsync — wymaga aktywacji w Control Center |
| 02-cron-radar.json | 2B5cItVoK72AgpjQ | Cron 07:00 | ✅ zsync — wymaga aktywacji |
| 03-slack-to-crm.json | C8eiEvfWZ835vCOj | Slack webhook | ✅ zsync — czeka na Slack Events config |
| 04-quote-followup.json | ohg9faeSXiNf4Jiu | Mon-Fri 09:00 | ✅ zsync — czeka na RESEND_FROM_EMAIL |
| 05-morning-digest.json | 9LoQbpuGrZ0nDI4v | Mon-Fri 08:30 | ✅ zsync — czeka na RESEND_FROM_EMAIL |

> Aktywuj przez: **Settings → Control Center** (toggle na każdy workflow)

### Slack — 6 slash commands

| Komenda | Opis |
|---------|------|
| `/77brief` | AI brief dnia (Guardian + Radar) |
| `/77crm` | Status CRM (klienci, zadania, wyceny) |
| `/77status` | Status systemu (env, koszty AI) |
| `/77radar` | World Radar na żądanie |
| `/77task` | Nowe zadanie z Slacka |
| `/77media` | Media monitoring digest |

> ⚠️ URL slash commands wskazuje na stary deployment URL. Po aktywacji domeny ds-ai.pl zaktualizuj w api.slack.com.

### Telegram Monitor (77STF Media — ODDZIELNY!)
- 13 kanałów monitorowanych
- Railway: forwarder.py działa
- `/dashboard/telegram` — live feed (usunięty z głównego sidebar, ale strona istnieje)

---

## 6. INTEGRACJE — CO DZIAŁA, CO NIE

| Integracja | Kod | Config | Działa |
|------------|-----|--------|--------|
| Supabase DB | ✅ | ✅ | ✅ |
| Supabase Auth (Magic Link) | ✅ | ✅ | ✅ |
| Claude API (AI) | ✅ | ✅ | ✅ |
| n8n (workflows) | ✅ | ✅ | ⚠️ Wymaga aktywacji toggles |
| Slack Events API (#quick-notes→CRM) | ✅ | ⚠️ | ❌ Request URL nie ustawiony w api.slack.com |
| Slack slash commands | ✅ | ⚠️ | ❌ Stary URL — zaktualizuj po domenie |
| Slack outgoing webhooks | ✅ | ✅ | ✅ |
| Telegram forwarder | ✅ | ✅ | ✅ |
| Resend (email) | ✅ | ⚠️ | ❌ Brak RESEND_FROM_EMAIL |
| Railway (auto-deploy) | ✅ | ✅ | ✅ |
| GitHub Actions | ✅ | ✅ | ✅ |
| Google OAuth | ✅ | ⚠️ | ❓ Sprawdź Supabase → Auth → Providers |
| Fireflies.ai | ❌ | ❌ | ❌ Nie zbudowany |
| WhatsApp (Meta API) | ❌ | ❌ | ❌ Nie zbudowany |
| Vapi.ai (Voice Agent) | ❌ | ❌ | ❌ Nie zbudowany |

---

## 7. ZNANE PROBLEMY

### Krytyczne (blokują)
1. **Migracja 012** — RLS security fix nie uruchomiony → dane bez ochrony
2. **Slack Events API** — Request URL nie ustawiony w api.slack.com → #quick-notes→CRM nie działa
3. **RESEND_FROM_EMAIL** brakuje → quote follow-up emails nie działają

### Wysokie
4. **SLACK_CHANNELS** — ustawiony placeholder, nie prawdziwe ID kanału
5. **Slash commands URL** — wskazuje na stary deployment, nie ds-ai.pl
6. **Migracje 005-011** — wiele funkcji niedostępnych (World Radar historia, Content Studio, rozszerzony AI log)
7. **Agent Operator** — brak kontekstu systemu, nie zna roadmapy ani kodu

### Średnie
8. **ds-ai.pl** — sprawdź status propagacji DNS (dodano A + CNAME w home.pl)
9. **N8N_API_KEY** — może brakować w Vercel (potrzebny do Control Center)
10. **Content Studio** — usunięty z sidebar, ale strona istnieje pod `/dashboard/content`

---

## 8. ROADMAP — CO DALEJ

### 🔥 TOP 3 NASTĘPNE (gotowe do realizacji)

#### A. Slack Events API — KONFIGURACJA (10 min, ręcznie)
Kod jest gotowy. Tylko konfiguracja:
1. Vercel → dodaj `SLACK_CHANNELS` = prawdziwe ID kanału #quick-notes
2. api.slack.com → twoja app → Event Subscriptions → Enable:
   - Request URL: `https://77stf-system-crypto77stf-4430s-projects.vercel.app/api/webhooks/slack-events`
   - Subscribe: `message.channels`
3. Weryfikacja: napisz na #quick-notes → notatka w CRM w ciągu 5s

#### B. n8n Control Center — AKTYWACJA (5 min, ręcznie)
Settings → Control Center → włącz:
- `n8n_guardian_cron` (Guardian 08:00)
- `n8n_radar_cron` (Radar 07:00)
- `n8n_morning_digest` (jak dodasz RESEND_FROM_EMAIL)

#### C. Fireflies Webhook — NOWA FUNKCJA (2-3h kodu)
Spotkanie z Avvlo → transkrypt → auto CRM notatka + zadania.
- Endpoint: `POST /api/webhooks/fireflies`
- Tabela: `013_meeting_transcripts.sql`
- `analyzeMeeting()` w `lib/claude.ts` już istnieje

### 🏗 TIER 1 (1-2 tygodnie)
- **WhatsApp → CRM** — Meta Business API webhook → notatki (gdy Avvlo jest na WhatsApp)
- **Resend FROM_EMAIL** — dodaj env var → włącz quote follow-up workflow
- **Slack slash commands** — zaktualizuj URL po aktywacji ds-ai.pl
- **Migracje 005-012** — uruchom w Supabase SQL Editor
- **Agent Operator 2.0** — inject system snapshot do systemu promptu

### 🏗 TIER 2 (tydzień 2-3)
- **Client Health Score** — AI churn risk, upsell opportunities per klient
- **Revenue Intelligence** — pipeline value, MRR forecast
- **Email Automation** — onboarding sequence, Guardian alerts przez Resend
- **Audit Wizard v2** — dodaj sekcję "Kontekst Biznesowy"

### 🏗 TIER 3 (miesiąc 2)
- **Multi-Agent Pipeline** — nowy klient → Scout research + Architect stack + Hunter email (auto)
- **Memory & Learning** — zaakceptowane wyceny enrichują pricing DB
- **Auto-Reporting** — miesięczny PDF dla klienta → Resend

### 🛸 ŚCIEŻKA KLIENCKA (gdy klient mówi "tak")
- Voice Agent DEMO (Vapi.ai + ElevenLabs) — dla Avvlo
- Opinion Response AI (Google Maps) — dla Avvlo
- Smart Chatbot RAG — dla Avvlo
- Social Media Auto-post

---

## 9. CODZIENNA RUTYNA PRACY (cel)

```
07:00 — Radar cron: World Radar digest generowany automatycznie
08:00 — Guardian cron: raport systemu generowany automatycznie
08:30 — Morning Digest przychodzi na Slack #daily-brief (n8n workflow 05)

Na bieżąco:
  Slack #quick-notes → wiadomość → auto CRM notatka (po konfiguracji Slack Events)
  CRM → Klienci → leady aktywne
  Zadania → co do zrobienia dziś

W razie potrzeby:
  Operator → naturalny język → akcje CRM
  Intelligence Hub → Radar / Content Scout
  Audyt → nowy klient → Wycena

Rzadko:
  Logi błędów (domyślnie 24h — tylko gdy coś się psuje)
  Koszty AI (tygodniowo)
  Settings → Control Center (włącz/wyłącz automaty)
```

---

## 10. KLUCZOWE PLIKI — GDZIE CO JEST

| Co | Plik |
|----|------|
| Design tokens | `lib/tokens.ts` |
| AI wrapper | `lib/claude.ts` |
| Model routing | `lib/ai-config.ts` |
| Slack helpers | `lib/slack.ts` |
| TypeScript types | `lib/types.ts` |
| Formattery (PLN, daty) | `lib/format.ts` |
| Rate limiting | `lib/rate-limit.ts` |
| Supabase klienty | `lib/supabase.ts` |
| Audit (29 pytań) | `lib/audit-questions.ts` |
| Sidebar | `app/dashboard/components/sidebar.tsx` |
| Layout dashboard | `app/dashboard/layout.tsx` |
| Middleware auth | `middleware.ts` |
| n8n workflows | `n8n-workflows/*.json` |
| n8n sync script | `n8n-workflows/sync.mjs` |
| Telegram forwarder | `scripts/telegram-forwarder/` |
| Migracje SQL | `supabase/migrations/` |

---

## 11. INSTRUKCJA — JAK UŻYWAĆ TEGO PLIKU

1. **Podczas pracy offline:** edytuj sekcje — zaznacz co zrobiłeś ✅, co jest nie tak ❌, co się zmieniło
2. **Przed nową sesją z Claude:** skopiuj ten plik jako prompt startowy z komentarzem "Oto aktualny stan — kontynuujemy od..."
3. **Po każdej sesji z Claude:** zaktualizuj sekcje 5, 6, 7 (co zostało zrobione)
4. **Env vars:** sprawdź sekcję 2 — zaznacz co faktycznie jest w Vercel

---

*Wygenerowano automatycznie 10.04.2026 przez Claude Code. Edytuj ręcznie w miarę postępów.*
