# Передача на другой ПК

## Структура приватного архива

`project/` — готовые исходники и материалы; `repository.bundle` — история Git; `private/ssh/fairround_ed25519` — закрытый ключ, `.pub` — публичный, `known_hosts` — проверенный ключ хоста. `private/production.env` — рабочая конфигурация сервера. `private/new-server.json` — адрес и имя пользователя. Секреты не копировать в `project/`.

Распакуйте архив в отдельную папку. Все относительные команды ниже выполняются из `project/`. Если нужен полноценный checkout, рядом выполните `git clone repository.bundle fairround`, затем `git remote set-url origin https://github.com/RY9N24/38947932048672349086`. Авторизуйтесь в GitHub собственным аккаунтом через Git Credential Manager/`gh auth login`: токен аккаунта в архив не извлекался.

## Сервер

Новый сервер `176.53.244.36`, пользователь `root`, 2 vCPU / 4 ГБ / 30 ГБ. HTTPS: https://fairround.176.53.244.36.sslip.io. Вход: `ssh -i ../private/ssh/fairround_ed25519 -o UserKnownHostsFile=../private/ssh/known_hosts root@176.53.244.36`.

Linux/macOS: `chmod 600 ../private/ssh/fairround_ed25519`. Windows: при ошибке прав OpenSSH отключите наследование ACL только у файла ключа и оставьте чтение текущему пользователю. Приватный ключ без парольной фразы — храните архив локально.

На сервере: `cd /opt/fairround/current`; `docker compose ps`; `docker compose logs --tail=100 api judge web`. `.env` ссылается на `/opt/fairround/shared/.env` (0600). PostgreSQL и Redis — в Docker volumes; **не запускать `down -v`**. Готовые локально образы сохранены в `/opt/fairround/artifacts/fairround-images.tar.gz`, SHA первоначального полного архива: `481173827adce31b31fff4b5d451ad590e14bebeb2b3f0f0d069fa3d99a34c40`; новая сборка указана в `docs/STATUS.md`. Кодовая сборка после приёмки — commit `3748fbf`; финальные материалы и отчёт могут иметь более новый commit без изменения приложения.

Материалы публично раздаются из `/opt/fairround/shared/materials` через `/materials/`. Там только PPTX/PDF/MP4. Не размещать env, ключи или handover. На сервере один judge-слот; не увеличивайте concurrency без замеров памяти.

## Локальная работа

Нужны Git, Docker Desktop с Linux-контейнерами, Node 22, pnpm 10.32.1, Chrome, Python 3. Точные команды — README. `corepack enable` либо `npx --yes pnpm@10.32.1 install --frozen-lockfile`. Запустите `node scripts/init-env.mjs`: он создаёт локальный `.env` со своими JWT/DB секретами. Production.env не использовать для общедоступной локальной разработки.

`docker compose build`; sandbox-образы собираются по README; `docker compose up -d`; сайт http://localhost:8080. В первый запуск миграция/seed выполняются API. Seed содержит демонстрационные данные и конечные временные окна.

## Проверки

Сначала `pnpm test` и `pnpm typecheck`. Браузер: PowerShell `$env:TEST_BASE_URL='http://localhost:8080'`, затем `node node_modules/@playwright/test/cli.js test`. Сценарии S1–S6 — `tests/e2e/platform.spec.ts`. Они создают реальные данные. Остальные тесты проверяют приглашения, доступ, эталон, сравнение и дизайн. `docs/BROWSER_QA.md` описывает запуск Playwright и критерии приёмки.

Для обновления сначала локальные проверки, сборка образов и canary. Скрипт `scripts/deploy-release.py` переносит готовые образы с SHA-256, не собирает приложение на VDS. Перед повторным запуском изучите аргументы: он загружает ~1 ГБ; приватный production.env должен совпадать с сервером. Образы приложения не включены в handover из-за размера: они сохранены на VDS и воспроизводятся Dockerfile/lockfile.

## Честные пределы

Docker sandbox ограничен, но не является доказанной защитой от всех kernel exploits; следующий шаг — gVisor/отдельные judge-хосты. Нагрузки 100 дуэлей/1000 участников не было. Elo/подбор не реализованы. Запись редактора — события и снимки кода, не видеозахват. Результат GitHub Actions не подтверждён. Подробно — LIMITATIONS.md.


После новой приёмки: время DISPLAY_TZ (по умолчанию Europe/Samara), подпись САМ; демо-окно минимум 14 дней с продлением при запуске seed. Тесты по умолчанию локальные. Для production: TEST_ALLOW_PRODUCTION=1; teardown использует ../private/ssh и манифесты artifacts/test-manifests, удаляет только созданные объекты. Не отключать cleanup. Обычный просмотр и захват скриншотов не требуют тестового режима.

Финальные образы после приёмки — /opt/fairround/artifacts/revision-final.tar, SHA в STATUS.md. Первоначальный полный архив с sandbox-образами также сохранён; не заменять его только веб-образом.


Точная настройка прав SSH-ключа в PowerShell (выполнять из project/):

```powershell
$keyPath = (Resolve-Path '../private/ssh/fairround_ed25519').Path
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $keyPath /inheritance:r
icacls $keyPath /grant:r "${currentUser}:(R)"
ssh -i $keyPath -o UserKnownHostsFile=../private/ssh/known_hosts root@176.53.244.36
```

Для входа на сервер используйте выделенный SSH-ключ.
