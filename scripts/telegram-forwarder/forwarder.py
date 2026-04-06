"""
77STF Telegram Forwarder Service
---------------------------------
Monitors Telegram channels using Telethon (MTProto).
Forwards every new message to 77STF webhook + the group topic.

SETUP (2 kroki):
  1. Lokalnie wygeneruj sesję:   python generate_session.py
  2. Wklej TELEGRAM_SESSION do Railway env variables

Requirements (zapisane w requirements.txt):
  pip install telethon python-dotenv aiohttp

Environment variables:
  TELEGRAM_API_ID        = 23984593
  TELEGRAM_API_HASH      = <nowy hash>
  TELEGRAM_SESSION       = <string z generate_session.py>
  WEBHOOK_URL            = https://twoja-app.vercel.app/api/webhooks/telegram
  TELEGRAM_WEBHOOK_SECRET= <twój secret>
  TARGET_GROUP_ID        = -1003683446930
"""

import os
import asyncio
import aiohttp
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from telethon.tl.types import (
    MessageMediaPhoto, MessageMediaDocument,
    MessageMediaWebPage, PeerChannel,
    DocumentAttributeVideo, DocumentAttributeAudio,
)

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('77stf-tg')

API_ID        = int(os.environ['TELEGRAM_API_ID'])
API_HASH      = os.environ['TELEGRAM_API_HASH']
SESSION_STR   = os.environ.get('TELEGRAM_SESSION', '')  # StringSession — no SMS needed on server

WEBHOOK_URL    = os.environ['WEBHOOK_URL']
WEBHOOK_SECRET = os.environ['TELEGRAM_WEBHOOK_SECRET']
TARGET_GROUP   = int(os.environ.get('TARGET_GROUP_ID', '0'))

# channel_id → topic_id in your supergroup
CHANNEL_MAP = {
    -1002360946496: {'name': 'MODELS RECRUITMENT', 'topic': 7},
    -1002202808162: {'name': 'CHATTING',            'topic': 11},
    -1003468377891: {'name': 'AI INTEGRATION',      'topic': 12},
    -1001895589451: {'name': 'GENERAL QUESTIONS',   'topic': 15},
    -1001916600905: {'name': 'REDDIT (+TRAFFIC)',    'topic': 2},
    -1001953219180: {'name': 'INSTAGRAM (+TRAFFIC)', 'topic': 4},
    -1001950386772: {'name': 'TIKTOK (+TRAFFIC)',    'topic': 6},
    -1002016536758: {'name': 'FETLIFE (+TRAFFIC)',   'topic': 8},
    -1001854651007: {"name": "GG'S (+TRAFFIC)",      'topic': 9},
    -1001929535484: {'name': 'TWITTER (+TRAFFIC)',   'topic': 5},
    -1002492477972: {'name': 'OFTV (+TRAFFIC)',      'topic': 10},
    -1001830816436: {'name': 'YOUTUBE (+TRAFFIC)',   'topic': 14},
    -1002003349867: {'name': 'THREADS (+TRAFFIC)',   'topic': 13},
}


def get_media_type(msg) -> str | None:
    if isinstance(msg.media, MessageMediaPhoto):
        return 'photo'
    if isinstance(msg.media, MessageMediaDocument):
        doc = msg.media.document
        for attr in getattr(doc, 'attributes', []):
            if isinstance(attr, DocumentAttributeVideo):
                return 'video'
            if isinstance(attr, DocumentAttributeAudio):
                return 'voice' if getattr(attr, 'voice', False) else 'audio'
        return 'document'
    return None


def format_forward_text(channel_name: str, sender: str, sent_dt: datetime, text: str,
                         media_type: str | None, reply_sender: str | None,
                         reply_text: str | None, forwarded_from: str | None) -> str:
    """Formats the message for posting to group topic."""
    lines = []
    lines.append(f'📢 *{channel_name}*')
    lines.append(f'👤 Od: {sender}')
    lines.append(f'🕐 {sent_dt.strftime("%d.%m.%Y %H:%M")}')

    if forwarded_from:
        lines.append(f'↪️ Forwarded z: {forwarded_from}')

    lines.append('━━━━━━━━━━━━━━━━')

    if reply_sender and reply_text:
        lines.append(f'💬 *Odpowiedź na @{reply_sender}:*')
        lines.append(f'_{reply_text[:150]}{"…" if len(reply_text) > 150 else ""}_')
        lines.append('')

    if media_type:
        icons = {'photo': '🖼', 'video': '🎬', 'audio': '🎵', 'voice': '🎤', 'document': '📎'}
        lines.append(f'{icons.get(media_type, "📎")} [{media_type.upper()}]')

    if text:
        lines.append(text)

    return '\n'.join(lines)


async def send_to_webhook(session: aiohttp.ClientSession, payload: dict) -> None:
    try:
        async with session.post(
            WEBHOOK_URL,
            json=payload,
            headers={'x-telegram-webhook-secret': WEBHOOK_SECRET},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status not in (200, 201):
                body = await resp.text()
                log.warning(f'Webhook returned {resp.status}: {body[:200]}')
    except Exception as e:
        log.error(f'Webhook error: {e}')


async def send_to_group_topic(client: TelegramClient, topic_id: int, text: str, msg) -> None:
    """Sends formatted message to group topic. Also forwards media if present."""
    if not TARGET_GROUP:
        return
    try:
        # Send text first
        await client.send_message(
            TARGET_GROUP,
            text,
            reply_to=topic_id,
            parse_mode='md',
        )
        # If message has media, forward it separately (can't forward, so download+reupload)
        if msg.media and not isinstance(msg.media, MessageMediaWebPage):
            try:
                file = await msg.download_media(bytes)
                if file:
                    await client.send_file(
                        TARGET_GROUP,
                        file,
                        reply_to=topic_id,
                    )
            except Exception as e:
                log.warning(f'Could not reupload media: {e}')
    except Exception as e:
        log.error(f'Group send error (topic {topic_id}): {e}')


async def main():
    if not SESSION_STR:
        raise RuntimeError('TELEGRAM_SESSION env var is empty. Run generate_session.py locally first.')

    client = TelegramClient(StringSession(SESSION_STR), API_ID, API_HASH)
    await client.start()
    log.info('Telegram client connected via StringSession')

    channel_ids = list(CHANNEL_MAP.keys())

    @client.on(events.NewMessage(chats=channel_ids))
    async def handle_message(event):
        msg = event.message
        chat = await event.get_chat()
        chat_id = chat.id

        # Normalize channel ID (Telethon may omit -100 prefix)
        if chat_id > 0:
            chat_id = -1000000000000 - chat_id if chat_id < 1000000000 else -(1000000000000 + chat_id)
        # Try both forms
        meta = CHANNEL_MAP.get(chat_id) or CHANNEL_MAP.get(int(f'-100{abs(chat_id)}'))
        if not meta:
            return

        channel_name = meta['name']
        topic_id = meta['topic']

        # Sender info
        sender = None
        sender_id = None
        sender_name = 'Kanał'
        sender_username = None
        try:
            sender = await msg.get_sender()
            if sender:
                sender_id = sender.id
                sender_name = getattr(sender, 'first_name', '') or getattr(sender, 'title', '') or 'Nieznany'
                if getattr(sender, 'last_name', None):
                    sender_name += f' {sender.last_name}'
                sender_username = getattr(sender, 'username', None)
        except Exception:
            pass

        # Reply-to info
        reply_to_id = None
        reply_to_sender = None
        reply_to_text = None
        if msg.reply_to_msg_id:
            reply_to_id = msg.reply_to_msg_id
            try:
                replied = await msg.get_reply_message()
                if replied:
                    rs = await replied.get_sender()
                    if rs:
                        reply_to_sender = getattr(rs, 'username', None) or getattr(rs, 'first_name', None) or 'user'
                    reply_to_text = (replied.text or '')[:200]
            except Exception:
                pass

        # Forwarded-from info
        forwarded_from = None
        if msg.fwd_from:
            try:
                if msg.fwd_from.from_name:
                    forwarded_from = msg.fwd_from.from_name
                elif msg.fwd_from.channel_id:
                    fc = await client.get_entity(PeerChannel(msg.fwd_from.channel_id))
                    forwarded_from = getattr(fc, 'title', None) or getattr(fc, 'username', None)
            except Exception:
                pass

        media_type = get_media_type(msg)
        text = msg.text or ''
        sent_dt = msg.date.replace(tzinfo=timezone.utc)

        # 1. Send to 77STF webhook (stores in DB + AI scoring)
        async with aiohttp.ClientSession() as session:
            payload = {
                'channel_id': str(int(f'-100{abs(chat_id)}') if not str(chat_id).startswith('-100') else chat_id),
                'channel_name': channel_name,
                'message_id': msg.id,
                'sender_id': sender_id,
                'sender_name': sender_name,
                'sender_username': sender_username,
                'content': text if text else None,
                'media_type': media_type,
                'reply_to_id': reply_to_id,
                'reply_to_sender': reply_to_sender,
                'reply_to_text': reply_to_text,
                'forwarded_from': forwarded_from,
                'sent_at': sent_dt.isoformat(),
            }
            await send_to_webhook(session, payload)

        # 2. Forward formatted message to group topic
        if topic_id:
            formatted = format_forward_text(
                channel_name=channel_name,
                sender=sender_name,
                sent_dt=sent_dt,
                text=text,
                media_type=media_type,
                reply_sender=reply_to_sender,
                reply_text=reply_to_text,
                forwarded_from=forwarded_from,
            )
            await send_to_group_topic(client, topic_id, formatted, msg)

        log.info(f'[{channel_name}] msg {msg.id} — media:{media_type} len:{len(text)}')

    log.info(f'Monitoring {len(channel_ids)} channels. Ctrl+C to stop.')
    await client.run_until_disconnected()


if __name__ == '__main__':
    asyncio.run(main())
