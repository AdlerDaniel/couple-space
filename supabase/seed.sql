-- Fictional development-only data. Never copy production rows into this file.
-- These placeholder Auth rows intentionally have no password; Playwright creates
-- disposable login-capable users through the local Auth admin API.

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'danya.dev@example.test', '{"name":"Даня Dev"}'::jsonb),
  ('20000000-0000-4000-8000-000000000002', 'polina.dev@example.test', '{"name":"Полина Dev"}'::jsonb),
  ('30000000-0000-4000-8000-000000000003', 'alex.dev@example.test', '{"name":"Алекс Dev"}'::jsonb),
  ('40000000-0000-4000-8000-000000000004', 'mira.dev@example.test', '{"name":"Мира Dev"}'::jsonb)
on conflict (id) do nothing;

insert into public.couples (id, invite_code, partner_one_id, partner_two_id)
values
  ('a0000000-0000-4000-8000-000000000001', 'DEVPAIR1', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000002', 'DEVPAIR2', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

insert into public.couple_profiles (
  id,
  couple_id,
  partner_one,
  partner_two,
  start_date,
  status_one_text,
  status_two_text
)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Даня Dev', 'Полина Dev', '2026-01-01', 'Тестирую', 'Проверяю'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Алекс Dev', 'Мира Dev', '2026-02-01', 'Локально', 'Безопасно')
on conflict (couple_id) do nothing;

insert into public.tracker_categories (id, name, slug, icon, color, sort_order, is_default)
values
  ('c1000000-0000-4000-8000-000000000001', 'Поели', 'food', 'utensils', '#a96836', 10, true),
  ('c2000000-0000-4000-8000-000000000002', 'Секс', 'sex', 'heart', '#ef4352', 20, true),
  ('c3000000-0000-4000-8000-000000000003', 'Спорт', 'sport', 'dumbbell', '#28a64f', 30, true),
  ('c4000000-0000-4000-8000-000000000004', 'Игры', 'games', 'gamepad-2', '#3178d8', 40, true),
  ('c5000000-0000-4000-8000-000000000005', 'Рисунки', 'drawings', 'palette', '#d94e9d', 50, true)
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_default = excluded.is_default;

insert into public.memories (id, couple_id, user_id, title, caption, text, is_pinned)
values
  ('d1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Первый тестовый момент', 'Только вымышленные данные', 'Локальное воспоминание пары A', true),
  ('d2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Чужой тестовый момент', 'Используется для проверки RLS', 'Локальное воспоминание пары B', false)
on conflict (id) do nothing;

insert into public.couple_chat_messages (id, couple_id, sender_id, body)
values
  ('e1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Сообщение тестовой пары A'),
  ('e2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Сообщение тестовой пары B')
on conflict (id) do nothing;

insert into public.question_answers (id, couple_id, date, question, answer_one)
values
  ('f1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '2026-08-04', 'Локальный вопрос пары A?', 'Локальный ответ A'),
  ('f2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', '2026-08-04', 'Локальный вопрос пары B?', 'Локальный ответ B')
on conflict (couple_id, date, question) do nothing;

insert into public.tracker_events (
  id,
  couple_id,
  category_id,
  date,
  count,
  created_by
)
values
  ('ab100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '2026-08-04', 1, '10000000-0000-4000-8000-000000000001'),
  ('ab200000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', '2026-08-04', 1, '30000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
values
  ('ac100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'https://push.example.test/pair-a', 'fictional-p256dh-a', 'fictional-auth-a'),
  ('ac200000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'https://push.example.test/pair-b', 'fictional-p256dh-b', 'fictional-auth-b')
on conflict (endpoint) do nothing;

insert into storage.buckets (id, name, public)
values
  ('memory-images', 'memory-images', false),
  ('question-media', 'question-media', false),
  ('quiz-media', 'quiz-media', false),
  ('watch-posters', 'watch-posters', false),
  ('chat-media', 'chat-media', false),
  ('profile-avatars', 'profile-avatars', false)
on conflict (id) do update set public = excluded.public;
