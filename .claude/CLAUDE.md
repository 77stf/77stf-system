# Projekt: 77STF System

## Stack
Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui (Radix), Supabase (PostgreSQL)

## Design
- Ciemna paleta
- Navy: #0B1F3A
- Złoty akcent: #B8922A
- Szare tło: #F5F7FA

## Zasady
- Język UI: polski
- Nazwy zmiennych i komentarze w kodzie: angielski
- Zawsze uruchom i sprawdź czy działa zanim pokażesz wynik
- Nigdy nie commituj do main bezpośrednio
- Jeden cel na sesję

## Struktura
- app/dashboard/ — widok właściciela firmy
- app/client/[token]/ — widok klienta (publiczny, bez logowania)
- app/api/ — API routes, webhooki
- components/dashboard/ — komponenty dashboardu
- components/documents/ — szablony dokumentów
- lib/supabase.ts — klient Supabase
- lib/claude.ts — wrapper Claude API

## Supabase
URL: https://hfvekuikmljagdwowhak.supabase.co
Tabele: (dodawaj w miarę tworzenia)

## Aktualny status
Etap 0 ukończony — projekt działa lokalnie, kod na GitHub.
Następny krok: Etap 1 — schemat bazy danych w Supabase.