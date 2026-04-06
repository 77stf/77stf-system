Analyze a video/reel URL and extract insights relevant to 77STF.

TRIGGER when: user pastes a URL from YouTube/Instagram/TikTok/Facebook, or says "przeanalizuj tę rolkę", "co sądzisz o tym wideo", "analiza linka", "transcript tego", "co można z tego wyciągnąć".

NOTE: This is a terminal preview. The full system feature (Video Intelligence) will be at /dashboard/intelligence (Etap 8) with Telegram integration and n8n pipeline. This command does a quick analysis for the owner directly in the terminal.

Steps:
1. Extract URL from $ARGUMENTS
2. If no URL, ask: "Wklej URL wideo do analizy"
3. Check if content-scout pipeline exists (scripts/content-scout.py):
   - If YES: run the script and show results
   - If NO (Etap 8 not done): do a quick manual analysis:
     a. Inform: "Pipeline Video Intelligence nie jest jeszcze gotowy (Etap 8). Robię szybką analizę."
     b. Attempt to fetch video title/description from URL metadata
     c. Ask user to paste transcript or key points if available
     d. Use Claude to analyze pasted content against 77STF stack and services
4. Show analysis in format:
   - **Tytuł / temat:** [co to jest]
   - **Kluczowe insighty:** (3-5 punktów)
   - **Zastosowanie w 77STF:** (konkretne features/etapy)
   - **Action suggestion:** [co zrobić z tym insightem]
   - **Tagi:** [ai-automation, voice-agent, cost-optimization, etc.]
5. Ask: "Dodać do tech_discoveries w bazie? (gdy Etap 8 będzie gotowy)"

Usage: /content-analyze https://youtu.be/example
Usage: /content-analyze
