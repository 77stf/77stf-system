Update memory files after a session to capture what was learned, changed, or decided.

TRIGGER when: user says "zapamiętaj", "zapisz to", "sync memory", "zaktualizuj pamięć", "zapisz po sesji", or at end of a session with significant changes.

Steps:
1. Ask the user 3 quick questions (or infer from conversation if context is clear):
   - Co nowego się wydarzyło / jakie decyzje podjęto?
   - Czy coś technicznego się zmieniło (architektura, priorytety, stack)?
   - Czy coś nie zadziałało — feedback do zapamiętania na przyszłość?
2. Read relevant existing memory files to check what needs updating (not creating duplicates)
3. Update or create memory files as appropriate:
   - New client/lead info → project_masterplan.md or new project file
   - Technical decision → project_design_system.md or relevant project file
   - User correction of Claude's behavior → feedback file
   - Priority changes → project_masterplan.md
4. Update MEMORY.md index if new files were created
5. Update the "Aktualny status" section in CLAUDE.md if etap status changed
6. Report: list of files updated and what was saved

Usage: /sync-memory
