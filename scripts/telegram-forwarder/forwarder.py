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
    DocumentAttributeFilename, MessageMediaPoll,
)

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('77stf-tg')

API_ID        = int(os.environ['TELEGRAM_API_ID'])
API_HASH      = os.environ['TELEGRAM_API_HASH']
SESSION_STR   = os.environ.get('TELEGRAM_SESSION', '')
WEBHOOK_URL   = os.environ['WEBHOOK_URL']
WEBHOOK_SECRET = os.environ['TELEGRAM_WEBHOOK_SECRET']
TARGET_GROUP  = int(os.environ.get('TARGET_GROUP_ID', '0'))

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

# topic_id used for formatting tests
TEST_TOPIC_ID = 140

CHANNEL_EMOJIS = {
    'MODELS RECRUITMENT': '👤', 'CHATTING': '💬', 'AI INTEGRATION': '🤖',
    'GENERAL QUESTIONS': '❓', 'REDDIT (+TRAFFIC)': '🔴', 'INSTAGRAM (+TRAFFIC)': '📸',
    'TIKTOK (+TRAFFIC)': '🎵', 'FETLIFE (+TRAFFIC)': '🔗', "GG'S (+TRAFFIC)": '🎮',
    'TWITTER (+TRAFFIC)': '🐦', 'OFTV (+TRAFFIC)': '📺', 'YOUTUBE (+TRAFFIC)': '▶️',
    'THREADS (+TRAFFIC)': '🧵',
}

MEDIA_ICONS = {
    'photo': '🖼️', 'video': '🎬', 'audio': '🎵',
    'voice': '🎤', 'document': '📎', 'sticker': '🎭', 'poll': '📊',
}


def html_escape(s: str) -> str:
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def get_media_info(msg) -> tuple[str | None, str | None]:
    """Returns (media_type, filename)."""
    if isinstance(msg.media, MessageMediaPhoto):
        return 'photo', None
    if isinstance(msg.media, MessageMediaPoll):
        return 'poll', None
    if isinstance(msg.media, MessageMediaDocument):
        doc = msg.media.document
        filename = None
        media_type = 'document'
        for attr in getattr(doc, 'attributes', []):
            if isinstance(attr, DocumentAttributeFilename):
                filename = attr.file_name
            elif isinstance(attr, DocumentAttributeVideo):
                media_type = 'video'
            elif isinstance(attr, DocumentAttributeAudio):
                media_type = 'voice' if getattr(attr, 'voice', False) else 'audio'
        return media_type, filename
    return None, None


def format_poll(msg) -> str | None:
    """Serializes a poll to readable HTML text."""
    if not isinstance(msg.media, MessageMediaPoll):
        return None
    poll = msg.media.poll
    question = html_escape(poll.question.text if hasattr(poll.question, 'text') else str(poll.question))
    options = '\n'.join(
        f'  • {html_escape(a.text.text if hasattr(a.text, "text") else str(a.text))}'
        for a in poll.answers
    )
    kind = '🗳️ QUIZ' if getattr(poll, 'quiz', False) else '📊 ANKIETA'
    return f'<b>[{kind}]</b> {question}\n{options}'


def build_sender_html(sender_name: str, sender_username: str | None, sender_id: int | None) -> str:
    """
    Returns clickable sender link if username is available,
    otherwise falls back to tg://user?id= deep link (works in Telegram).
    Plain text only as last resort.
    """
    safe_name = html_escape(sender_name)
    if sender_username:
        return f'<a href="https://t.me/{sender_username}">{safe_name}</a>'
    elif sender_id:
        return f'<a href="tg://user?id={sender_id}">{safe_name}</a>'
    return f'<b>{safe_name}</b>'


def format_forward_text(
    channel_name: str,
    sender_name: str,
    sender_username: str | None,
    sender_id: int | None,
    sent_dt: datetime,
    text: str,
    media_type: str | None,
    filename: str | None,
    reply_sender: str | None,
    reply_text: str | None,
    forwarded_from: str | None,
) -> str:
    """Formats the message as HTML for posting to group topic."""
    ch_emoji = CHANNEL_EMOJIS.get(channel_name, '📢')
    time_str = sent_dt.strftime('%d.%m  %H:%M')

    sender_html = build_sender_html(sender_name, sender_username, sender_id)

    lines = []

    # Header — only emoji + time + sender (no channel name, we know the topic)
    lines.append(f'{ch_emoji}  <code>{time_str}</code>  ·  {sender_html}')

    if forwarded_from:
        lines.append(f'↪️ <i>Forwarded z: {html_escape(forwarded_from)}</i>')

    # Shorter divider
    lines.append('──────────────')

    # Reply context
    if reply_sender and reply_text:
        preview = html_escape(reply_text[:100]) + ('…' if len(reply_text) > 100 else '')
        lines.append(f'<blockquote>↩ {html_escape(reply_sender)}: {preview}</blockquote>')

    # Media indicator with filename if available (polls handled separately below)
    if media_type and media_type != 'poll':
        icon = MEDIA_ICONS.get(media_type, '📎')
        if filename:
            lines.append(f'{icon} <b>{html_escape(filename)}</b>')
        else:
            lines.append(f'{icon} <i>[{media_type}]</i>')

    # Main content
    if text:
        if media_type and media_type != 'poll':
            lines.append('')
        lines.append(html_escape(text))

    return '\n'.join(lines)


# ─── Rate limit queue ─────────────────────────────────────────────────────────
# Batching: max 1 media reupload per 0.5s per group to avoid Telegram flood wait

_upload_semaphore = asyncio.Semaphore(1)

async def _rate_limited_upload(client: TelegramClient, group: int, file_bytes: bytes,
                                topic_id: int, filename: str | None) -> None:
    async with _upload_semaphore:
        await client.send_file(
            group,
            file_bytes,
            reply_to=topic_id,
            attributes=[DocumentAttributeFilename(filename)] if filename else [],
            force_document=False,
        )
        await asyncio.sleep(0.5)


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


async def send_to_group_topic(
    client: TelegramClient,
    topic_id: int,
    text: str,
    msg,
    filename: str | None,
    poll_text: str | None,
) -> None:
    """Sends formatted message to group topic. Also forwards media with proper filename."""
    if not TARGET_GROUP:
        return
    try:
        # For polls: append poll content directly to the formatted message
        final_text = text
        if poll_text:
            final_text = text + '\n\n' + poll_text

        await client.send_message(
            TARGET_GROUP,
            final_text,
            reply_to=topic_id,
            parse_mode='html',
        )

        # Reupload media (skip polls — they're serialized to text above)
        if msg.media and not isinstance(msg.media, (MessageMediaWebPage, MessageMediaPoll)):
            try:
                file_bytes = await msg.download_media(bytes)
                if file_bytes:
                    await _rate_limited_upload(client, TARGET_GROUP, file_bytes, topic_id, filename)
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
        meta = CHANNEL_MAP.get(chat_id) or CHANNEL_MAP.get(int(f'-100{abs(chat_id)}'))
        if not meta:
            return

        channel_name = meta['name']
        topic_id = meta['topic']

        # Sender info
        sender_name = 'Kanał'
        sender_username = None
        sender_id = None
        try:
            sender = await msg.get_sender()
            if sender:
                sender_id = sender.id
                first = getattr(sender, 'first_name', '') or ''
                last = getattr(sender, 'last_name', '') or ''
                title = getattr(sender, 'title', '') or ''
                sender_name = f'{first} {last}'.strip() or title or 'Nieznany'
                sender_username = getattr(sender, 'username', None) or None
        except Exception:
            pass

        # Reply-to info
        reply_to_sender = None
        reply_to_text = None
        if msg.reply_to_msg_id:
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

        media_type, filename = get_media_info(msg)
        poll_text = format_poll(msg)
        text = msg.text or ''
        sent_dt = msg.date.replace(tzinfo=timezone.utc)

        # 1. Send to 77STF webhook
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
                'filename': filename,
                'reply_to_id': msg.reply_to_msg_id,
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
                sender_name=sender_name,
                sender_username=sender_username,
                sender_id=sender_id,
                sent_dt=sent_dt,
                text=text,
                media_type=media_type,
                filename=filename,
                reply_sender=reply_to_sender,
                reply_text=reply_to_text,
                forwarded_from=forwarded_from,
            )
            await send_to_group_topic(client, topic_id, formatted, msg, filename, poll_text)

        log.info(f'[{channel_name}] msg {msg.id} — media:{media_type} file:{filename} len:{len(text)}')

    log.info(f'Monitoring {len(channel_ids)} channels. Ctrl+C to stop.')
    await client.run_until_disconnected()


if __name__ == '__main__':
    asyncio.run(main())
