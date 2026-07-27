# Мониторинг давления медицинских газов

Проект системы мониторинга давления O₂, AIR и N₂O на базе PT-506, WB-MAI6, USR-DR134, Node-RED и InfluxDB.

## Статус

Рабочий продуктовый flow реализован и запускается в воспроизводимой Docker-среде Node-RED + InfluxDB. Он опрашивает три Input Register через Modbus TCP, проверяет и масштабирует значения, формирует состояния `НОРМА` / `ВНИМАНИЕ` / `АВАРИЯ` / `НЕТ ДАННЫХ`, сохраняет корректные измерения, предоставляет страницы мониторинга и истории и готов к отправке переходов состояния в MAX.

Исходный экспорт сохранён первым Git-коммитом. Подтверждённый в нём дефект `Circular config node dependency detected: modbus-client` устранён заменой конфликтующей serial-конфигурации на отдельный TCP-клиент.

Система не считается готовой к клинической эксплуатации до утверждения порогов, проверки электрической части и датчиков, обследования места установки, выполнения требований информационной безопасности и подписания протокола приёмки.

## Происхождение flow

```text
Path: flows/flows.json
SHA-256: 200698513A4A3B6CC07AADBCC3694B396D4C40EDB5302E0A2147B8C83923B668
Size: 37308 bytes
JSON: array of 25 objects
```

Исходный импорт с SHA-256 `B51B…57` сохранён в первом Git-коммите. Происхождение входных материалов описано в `docs/source-register.md`.

## Локальный запуск

```powershell
Copy-Item .env.example .env
docker compose --env-file .env -f docker/compose.yaml config
docker compose --env-file .env -f docker/compose.yaml build
docker compose --env-file .env -f docker/compose.yaml up -d
docker compose --env-file .env -f docker/compose.yaml ps
```

Фактические результаты аудита и продуктового прогона находятся в `docs/audit/RUNTIME_AUDIT_2026-07-27.md`.

## Целевая архитектура

```text
PT-506 4–20 mA
       ↓
WB-MAI6 / Modbus RTU
       ↓
USR-DR134 / Modbus TCP
       ↓
Node-RED → Dashboard
       ↓
InfluxDB
```

Рабочий профиль: `192.168.50.10:502`, Unit ID `65`, `9600 8N1` на RTU-стороне, Input Register `5380` / `9476` / `13572`, масштаб `raw / 10`, poll `5 s`, stale timeout `20 s`.

Пороги каждого газа и общий гистерезис задаются в `.env`; текущие значения `4,0–6,0 bar` и `3,5–6,5 bar` являются стендовыми, а не клинически утверждёнными. Аппаратная и клиническая приёмка выполняются по `tests/acceptance-checklist.md`.

Обязательные эксплуатационные документы:

- `docs/wb-mai6-commissioning.md` — настройка входов 4–20 мА и шкалы;
- `docs/debian-13.md` — production-развёртывание и kiosk;
- `docs/max-notifications.md` — подключение MAX;
- `docs/backup-restore.md` — backup и restore.

## Правила репозитория

- `flows/flows.json` — единственный рабочий flow; исходное состояние сохранено первым Git-коммитом.
- Секреты, Node-RED credentials, InfluxDB tokens и локальные данные в Git не добавляются.
- Docker images и npm dependencies должны иметь точные версии.
- Изменения flow, инфраструктуры и документации проходят отдельные проверки и осмысленные коммиты.
- Runtime-состояние подтверждается логами и тестами, а не только содержимым репозитория.
