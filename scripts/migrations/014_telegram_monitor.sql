-- Migration 014: Telegram Channel Monitor
-- Stores forwarded messages from all monitored Telegram channels
-- Run in Supabase SQL Editor

create table if not exists telegram_messages (
  id              uuid primary key default gen_random_uuid(),
  channel_id      text        not null,
  channel_name    text        not null,
  message_id      bigint      not null,
  sender_id       bigint,
  sender_name     text,
  sender_username text,
  content         text,
  media_type      text,        -- photo | video | document | audio | voice | sticker | poll
  media_file_id   text,        -- Telegram file_id for bots to re-send
  reply_to_id     bigint,
  reply_to_sender text,
  reply_to_text   text,        -- first 200 chars of replied-to message
  forwarded_from  text,        -- original channel/user if message was forwarded
  ai_score        smallint,    -- 0-10 importance (Haiku)
  ai_flag         text,        -- 'urgent' | 'opportunity' | 'issue' | null
  sent_at         timestamptz not null,
  created_at      timestamptz default now(),
  raw             jsonb       default '{}'
);

-- Unique constraint: same channel can't have duplicate message IDs
create unique index if not exists idx_telegram_msg_unique
  on telegram_messages (channel_id, message_id);

create index if not exists idx_telegram_msg_sent
  on telegram_messages (sent_at desc);

create index if not exists idx_telegram_msg_channel_sent
  on telegram_messages (channel_id, sent_at desc);

create index if not exists idx_telegram_msg_ai_flags
  on telegram_messages (ai_flag, sent_at desc)
  where ai_flag is not null;

create index if not exists idx_telegram_msg_high_score
  on telegram_messages (ai_score desc, sent_at desc)
  where ai_score >= 7;

-- RLS
alter table telegram_messages enable row level security;

create policy "Authenticated users can read telegram messages"
  on telegram_messages for select
  using (auth.role() = 'authenticated');

-- Only service role (used by API webhook) can insert/update
-- (No insert policy for anon/authenticated — only service_role bypasses RLS)
