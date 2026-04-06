# /research-scout — Self-Learning Research Agent

Prowadzisz deep research dla 77STF. Szukasz nowych informacji które:
- Challengeują lub aktualizują naszą obecną wiedzę i stack
- Wprowadzają nowe narzędzia AI, automatyzacje, modele które możemy wdrożyć u klientów
- Zawierają strategie content marketingu dla MŚP (szczególnie Instagram/TikTok)
- Dotyczą polskiego rynku B2B tech/AI

## Kroki do wykonania:

1. **Przeszukaj HN** (hacker-news.firebaseio.com/v0/topstories) — top 30 stories
2. **Przeszukaj WebSearch** — zapytania:
   - "Claude API new features 2026"
   - "n8n automation Polish SMB"
   - "Instagram carousel viral formula 2026"
   - "AI voice agent use cases"
   - "Vapi.ai updates"
3. **Przeszukaj Reddit** — r/nocode, r/entrepreneur, r/artificial
4. **Cross-reference** z CLAUDE.md — czy to naprawdę nowe? Czy już mamy?
5. **Zapisz** do `C:\Users\crypt\.claude\projects\c--Users-crypt-77stf-system\memory\research_learnings.md`

## Format zapisu:

```markdown
## [DATA] — [TEMAT]
**Źródło:** URL
**Co zmienia:** jedno zdanie — co to dodaje lub obala
**Akcja:** BUILD | UPGRADE_AGENT | ADD_TO_ROADMAP | MONITOR
```

6. **Wyczyść** wpisy starsze niż 30 dni które mają status MONITOR (nie doprowadziły do akcji)

Uruchom i zapisz wyniki. Potem raportuj mi co znalazłeś.
