# Мониторинг давления медицинских газов

Проект системы мониторинга давления O₂, AIR и N₂O на базе PT-506, WB-MAI6, USR-DR134, Node-RED и InfluxDB.

## Статус

Рабочий продуктовый flow реализован и запускается в воспроизводимой Docker-среде Node-RED + InfluxDB. Он опрашивает три Input Register через Modbus TCP, проверяет и масштабирует значения, формирует состояния `НОРМА` / `ВНИМАНИЕ` / `АВАРИЯ` / `НЕТ ДАННЫХ`, сохраняет корректные измерения и предоставляет страницы мониторинга и истории.

Исходный экспорт сохранён первым Git-коммитом. Подтверждённый в нём дефект `Circular config node dependency detected: modbus-client` устранён заменой конфликтующей serial-конфигурации на отдельный TCP-клиент.

Система не считается готовой к клинической эксплуатации до утверждения порогов, проверки электрической части и датчиков, обследования места установки, выполнения требований информационной безопасности и подписания протокола приёмки.

## Происхождение flow

```text
Path: flows/flows.json
SHA-256: B51B3CD874E496FDDA802CEA91FA8719FAB04FF7DD1BE0D3C4079DB743C1EB57
Size: 26019 bytes
JSON: array of 36 objects
```

Происхождение входных материалов описано в `docs/source-register.md`.

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

Стендовые пороги `4,0–6,0 bar` и `3,5–6,5 bar` реализованы, но не являются клинически утверждёнными. Аппаратная и клиническая приёмка выполняются по `tests/acceptance-checklist.md`.

## Правила репозитория

- `flows/flows.json` — единственный рабочий flow; исходное состояние сохранено первым Git-коммитом.
- Секреты, Node-RED credentials, InfluxDB tokens и локальные данные в Git не добавляются.
- Docker images и npm dependencies должны иметь точные версии.
- Изменения flow, инфраструктуры и документации проходят отдельные проверки и осмысленные коммиты.
- Runtime-состояние подтверждается логами и тестами, а не только содержимым репозитория.
