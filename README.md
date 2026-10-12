ПОЛЕ ЧУДЕС 5.2 — Cloudflare Worker + D1

База: pole-chudes-db
ID: fde46223-a4fb-419e-954f-cdd479656925

1. Загрузить содержимое ЭТОГО архива в корень GitHub репозитория dirli6425-cpu/pole-chudes.
   ВАЖНО: файлы index.html, laboratory.jpg, building.jpg находятся внутри public/.
   Старые одноимённые файлы в корне можно удалить, но не обязательно.
   Файлы worker.js, wrangler.toml и migrations/ должны быть в корне.
2. В Cloudflare -> pole-chudes -> Settings -> Builds -> Deploy command поставить ОДНУ строку:
   npx wrangler d1 migrations apply pole-chudes-db --remote --yes && npx wrangler deploy --config wrangler.toml
   Build command: пусто. Root directory: / (корень репозитория).
   Дата 2026-10-06 уже есть в wrangler.toml; не требуется менять.
3. Сохранить настройку сборки и запустить Redeploy/Retry deployment.
   Миграция создаёт таблицу и добавляет 5 начальных вопросов ТОЛЬКО если записей ещё нет.
4. После успешного деплоя в Settings -> Variables and Secrets добавить секрет ADMIN_KEY
   (любой свой длинный пароль, НЕ присылать его в чат). После изменения секрета может
   потребоваться новая публикация. Это пароль для записи вопросов.
5. Проверить https://pole-chudes.dirli6425.workers.dev/api/config — должен возвращаться JSON с groups и rounds.
   Затем обновить страницу сайта Ctrl+F5. В настройках сохранить вопросы с ADMIN_KEY.

Полный сброс игры удаляет только прогресс в браузере, не вопросы в D1.
Привязка D1 через wrangler.toml; API в worker.js; сайт в public/.
