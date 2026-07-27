# Мониторинг давления медицинских газов

Проект системы мониторинга давления O₂, AIR и N₂O на базе PT-506, WB-MAI6, USR-DR134, Node-RED и InfluxDB.

## Статус

Репозиторий находится на этапе воспроизводимого восстановления прототипа. Исходное состояние `flows/flows.json` зафиксировано первым Git-коммитом. Локальная Docker-среда Node-RED + InfluxDB собрана и проверена; runtime-аудит подтвердил дефект `Circular config node dependency detected: modbus-client`.

Система не считается готовой к клинической эксплуатации до утверждения порогов, проверки электрической части и датчиков, обследования места установки, выполнения требований информационной безопасности и подписания протокола приёмки.

## Подтверждённый исходный flow

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

Фактические результаты первого запуска находятся в `docs/audit/RUNTIME_AUDIT_2026-07-27.md`.

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

Точные параметры транспорта, пороги и правила обработки потери данных будут зафиксированы после проверки baseline и согласования с владельцем системы.

## Правила репозитория

- `flows/flows.json` — единственный рабочий flow; исходное состояние сохранено первым Git-коммитом.
- Секреты, Node-RED credentials, InfluxDB tokens и локальные данные в Git не добавляются.
- Docker images и npm dependencies должны иметь точные версии.
- Изменения flow, инфраструктуры и документации проходят отдельные проверки и осмысленные коммиты.
- Runtime-состояние подтверждается логами и тестами, а не только содержимым репозитория.
