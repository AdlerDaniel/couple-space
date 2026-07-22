# Couple Space

Личное пространство для пары на Next.js 16 и Supabase: вопрос дня и архив,
воспоминания, чат, викторины, совместный трекер, список фильмов и push-уведомления.

## Локальный запуск

Требуется Node.js 20.9 или новее.

1. Установите зависимости: `npm ci`.
2. Создайте `.env.local` по списку переменных ниже.
3. Запустите `npm run dev`.
4. Откройте `http://localhost:3000`.

Основные переменные окружения:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — только на сервере
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `CRON_SECRET`
- `TMDB_READ_ACCESS_TOKEN` или `TMDB_API_KEY`

Не добавляйте `.env.local` и service-role ключ в Git.

## Проверки

- `npm run check` — TypeScript, ESLint и unit/contract-тесты.
- `npm run build` — production-сборка Next.js/Vercel.
- `npm run build:sites` — production-сборка Sites/vinext.
- `npm run screenshots:mobile` — визуальные мобильные сценарии Playwright.

## Supabase

Авторитетная история схемы находится в `supabase/migrations/`. Миграции нужно
применять в порядке timestamp и координировать с соответствующим деплоем сайта.
Перед изменениями production-базы обязательно сделайте резервную копию и
проверьте Security/Performance Advisors.

Root-файлы `supabase-*.sql` сохранены как исторические снимки отдельных функций.
Не применяйте их поверх рабочей базы вместо versioned migrations.

## Архитектура безопасности

- браузер работает с publishable/anon ключом и ограничен RLS;
- service-role ключ используется только в Route Handlers;
- создание, вступление и выход из пары проходят через авторизованный серверный API;
- личные таблицы доступны только участникам соответствующей пары;
- пути загружаемых медиа начинаются с UUID пары или пользователя;
- ресурсоёмкие API требуют сессию и ограничивают частоту запросов.

## Deployment targets

- Vercel: `npm run build` и `npm run start`.
- Sites: `npm run build:sites` и `npm run start:sites`.
- Sites определяет `DEPLOY_TARGET=sites`; на Vercel переменная не задаётся.

Vercel остаётся единственным scheduler для ежедневного вопроса из `vercel.json`.
Оба deployment используют один проект Supabase и одни VAPID-ключи.
