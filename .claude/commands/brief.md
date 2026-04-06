Generate a quick AI Meeting Brief for a client directly in the terminal.

TRIGGER when: user says "przygotuj mnie na spotkanie", "brief dla [klienta]", "co wiem o [klient]", "meeting prep", "przygotowanie do rozmowy z".

NOTE: This is a terminal shortcut. The full system feature lives at /dashboard/clients/[id]/prep — workers use that. This command is for the owner to quickly get a brief without opening the browser.

Steps:
1. If client name is provided in $ARGUMENTS, search for the client in Supabase via the API:
   - Call GET /api/clients?search=[name] to find the client ID
2. If no argument, ask: "Dla którego klienta?"
3. Call GET /api/clients/[id]/meeting-prep to generate the brief
4. Display the brief in a readable format:
   - Executive summary (bold)
   - Top 3 pain points
   - Top 2 proposed solutions with ROI
   - Top 5 questions to ask
   - Closing strategy
5. Say: "Pełny brief z ROI i szczegółami: /dashboard/clients/[id]/prep"

Usage: /brief Avvlo
Usage: /brief
