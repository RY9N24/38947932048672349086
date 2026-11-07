# Честный раунд

Платформа соревнований по программированию: личные контесты, дуэли по приглашению и команды из двух человек. Решения Python и C++ проверяются в отдельных Docker-контейнерах. Организатор может восстановить историю редактора, перейти к внешней вставке и зафиксировать своё решение.

Первичное задание жюри: [CASE.pdf](docs/source/CASE.pdf). Подробные проектные решения: [описание архитектуры](docs/ARCHITECTURE.md).

Рабочий стенд: **https://fairround.176.53.244.36.sslip.io**. Фактический статус развёртывания и результаты проверок — [docs/STATUS.md](docs/STATUS.md).

## Для показа жюри

Откройте [START_HERE.md](START_HERE.md): там порядок показа, расположение презентации, речи, видео и демо-решений. Сценарии приёмки: [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

На странице `/login` есть пять кнопок демо-входа. Разные участники должны быть в **разных профилях браузера / инкогнито**, иначе cookie одного аккаунта заменит другой.

| Роль | Email | Пароль демо-аккаунта |
|---|---|---|
| Организатор | org@demo.local | FairRound2026! |
| Иван, участник 1 | user1@demo.local | FairRound2026! |
| Анна, участник 2 | user2@demo.local | FairRound2026! |
| Дарья, участник 3 | user3@demo.local | FairRound2026! |
| Михаил, участник 4 | user4@demo.local | FairRound2026! |

Это намеренно публичные демо-доступы, не доступ к серверу. У Дарьи и Михаила уже есть команда «Две переменные». Иван и Анна подходят для создания новой команды и дуэли. Завершённый «Отборочный тур» содержит **синтетические** записи для демонстрации проверки.

## Локальный запуск

Нужны Docker Engine / Desktop с Linux-контейнерами, Compose v2 и Node.js 22. На Windows включите WSL2 backend в Docker Desktop. Не используйте Windows containers.

```sh
node scripts/init-env.mjs
docker build -t fairround-sandbox-python -f sandbox/python/Dockerfile .
docker build -t fairround-sandbox-cpp -f sandbox/cpp/Dockerfile .
docker compose up -d --build
```

Откройте **http://localhost:8080**. Миграции и начальные демо-данные создаются автоматически при первом запуске API. Второй запуск seed не перезаписывает БД.

```sh
docker compose ps
docker compose logs --tail=100 api judge
docker compose down
```

Остановка `down` сохраняет данные в томах. **Не добавляйте `-v`, если хотите сохранить результаты.**

## Разработка и проверки

Используйте **pnpm 10.32.1** из `packageManager`. Если системный pnpm другой версии: `npx --yes pnpm@10.32.1 <команда>`. Не меняйте глобальные настройки.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm test
pnpm typecheck
```

Нативный dev на Windows: поднять `docker compose -f compose.yaml -f compose.local.yaml up -d postgres redis`; выполнить `. ./scripts/local-env.ps1` в каждом из терминалов API/judge, затем `pnpm --filter @fairround/api dev`, `pnpm --filter @fairround/judge dev`, `node scripts/copy-monaco.mjs` и `pnpm --filter @fairround/web dev`. Сайт будет на `http://localhost:3000`.

```sh
pnpm test:judge
pnpm exec playwright install chromium ffmpeg
pnpm test:e2e
```

По умолчанию Playwright использует установленный Google Chrome; для Linux без Chrome измените `channel` в `playwright.config.ts` на `undefined`, либо установите Chrome через `pnpm exec playwright install chrome`. Браузерные проверки описаны в [docs/BROWSER_QA.md](docs/BROWSER_QA.md).

Сброс **только демонстрационной БД** требует явного флага:

```sh
docker compose exec -e ALLOW_SEED_RESET=true api pnpm seed:reset
```

Он удалит все аккаунты, решения и контесты в этой БД. Демо-контесты рассчитаны на 5 часов после seed; перед защитой заранее подготовьте свежий стенд и повторите приёмку. Сброс публичного стенда с чужими данными без разрешения недопустим.

## Архитектура и правила

Next.js 15 / React 19 → Caddy → NestJS 11 / Socket.IO → PostgreSQL 16 / Prisma 6. BullMQ и Redis 7 передают решения отдельному judge-воркеру. Воркер запускает песочницу через Docker API; API и веб не имеют Docker-сокета.

- ICPC: больше решённых задач, затем меньше штраф. CE в штраф не входит; неудачи после первого OK не учитываются. Штраф — минуты до OK + 20 минут за неудачную попытку до него.
- IOI: лучший процент пройденных тестов по каждой задаче, сумма баллов; при равенстве делят место.
- Дуэль: число задач → штраф (неудачная попытка +2 минуты) → последнее OK → ничья. При нуле решённых — ничья. Сдача означает поражение. Таймер продолжает идти при обрыве.
- Командный зачёт: общие результаты, отдельные редакторы, мягкие метки задач, просмотр кода напарника и чат.

Подробнее: [ARCHITECTURE.md](docs/ARCHITECTURE.md), [INTEGRITY.md](docs/INTEGRITY.md), [LIMITATIONS.md](docs/LIMITATIONS.md), [DECISIONS.md](docs/DECISIONS.md).

SSH-ключи, пароли VDS, рабочие `.env` и приватный handover хранятся **вне репозитория**. Для переноса читайте [HANDOVER.md](docs/HANDOVER.md).
