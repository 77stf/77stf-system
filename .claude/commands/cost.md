Show AI usage costs for the current month from the system.

TRIGGER when: user says "ile kosztuje AI", "koszty AI", "burn rate", "wydatki na Claude", "ile wydaliśmy", "cost tracking".

NOTE: This is a terminal shortcut. The full firmowy panel kosztów dla całego zespołu będzie na /dashboard/ai-costs (Etap 5b). Gdy Etap 5b będzie gotowy, pracownicy będą używać dashboardu — ten command to skrót dla właściciela.

Steps:
1. Check if ai_usage_log table exists:
   - Try: call GET /api/ai-costs (if Etap 5b is done)
   - If 404: inform user Etap 5b (AI Cost Tracking) is not yet implemented
2. If table exists, show:
   - Total cost this month (PLN + USD)
   - Breakdown by feature (meetingBrief, auditAnalysis, etc.)
   - Breakdown by model (Haiku/Sonnet/Opus)
   - Most expensive client (if client_id tracked)
   - Estimate: "At this rate, monthly cost = X PLN"
3. If Etap 5b not done, show current model config from lib/ai-config.ts and estimate:
   - "Haiku = ~0.00125$/1k tokens, Sonnet = ~0.015$/1k tokens"
   - "Typical brief = ~1500 tokens output ≈ 0.02 USD ≈ 0.08 PLN"
   - Recommend: "Wdróż Etap 5b aby śledzić realne koszty w dashboardzie dla całego zespołu"

Usage: /cost
