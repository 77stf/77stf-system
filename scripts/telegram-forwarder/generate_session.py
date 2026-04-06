"""
KROK 1 — Uruchom TEN skrypt lokalnie (jednorazowo) na swoim komputerze.
Wygeneruje ciąg tekstowy (Session String) który wklejasz do Railway.

Instalacja:
  pip install telethon

Uruchomienie:
  python generate_session.py
"""

import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID   = int(input("Wpisz API ID (23984593): ") or "23984593")
API_HASH = input("Wpisz API Hash (nowy po regeneracji): ").strip()
PHONE    = input("Wpisz numer telefonu z +48: ").strip()

async def main():
    async with TelegramClient(StringSession(), API_ID, API_HASH) as client:
        await client.start(phone=PHONE)
        session_string = client.session.save()
        print("\n" + "="*60)
        print("TWÓJ SESSION STRING (wklej do Railway jako TELEGRAM_SESSION):")
        print("="*60)
        print(session_string)
        print("="*60)
        print("\nGotowe! Skopiuj ten string i wklej jako env variable.")

asyncio.run(main())
