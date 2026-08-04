# Бесплатная локальная разработка

Основной production-сайт разворачивается на Vercel. Sites остаётся вторичной средой совместимости и не определяет архитектуру проекта.

Для разработки базы используется только бесплатный локальный Supabase CLI. Платные cloud branches и отдельный hosted staging-проект не требуются.

## Требования

- Node.js 22 или новее;
- Docker Desktop либо совместимый Docker runtime;
- зависимости проекта, установленные через `npm ci`.

## Команды

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:test
npm run supabase:lint
npm run test:e2e:archive-realtime
npm run test:e2e:public
```

После запуска локальные адреса и ключи можно получить командой:

```bash
npx --yes supabase@2.111.0 status -o env
```

Их следует передавать приложению только через локальный `.env.local`. Нельзя копировать локальные ключи в Vercel и нельзя запускать `db reset` с флагом `--linked`.

`supabase/seed.sql` содержит только вымышленные данные. Проверки из `supabase/tests` подтверждают изоляцию данных разных пар через RLS.
