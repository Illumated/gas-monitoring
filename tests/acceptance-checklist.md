# Acceptance checklist

## Build

- [x] Images закреплены version и digest.
- [x] `docker compose config` проходит.
- [x] Build воспроизводится без cache.
- [x] Secret scan проходит.

## Runtime

- [x] Node-RED healthy.
- [x] InfluxDB healthy.
- [x] Volumes сохраняются после restart.
- [x] Startup logs не содержат unknown nodes.
- [x] Dashboard routes открываются.

## Flow

- [x] Три канала имеют документированное соответствие газам.
- [x] Scaling подтверждён программным contract test.
- [x] Invalid values дают `НЕТ ДАННЫХ`.
- [x] Stale timeout работает, включая context после restart.
- [x] Reconnect FAT simulator не требует ручного Deploy.
- [x] Переходы состояния сохраняются отдельно от усреднённой истории.
- [x] Startup/restart не создаёт ложные MAX-уведомления.
- [x] Пороговые границы и гистерезис проверены для O₂, AIR и N₂O.
- [x] MAX-шаблоны проверены для warning, alarm, nodata, recovery и reminder.

## HMI

- [x] Четыре статуса заданы текстом независимо от цвета.
- [x] Общий статус имеет фиксированный приоритет.
- [x] 1280×720, 1366×768 и 1920×1080 без document/widget overflow.
- [x] `0.0 bar` отображается числом, отсутствие данных — знаком `—` и текстом.
- [x] History использует фактическую шкалу и пороги и показывает разрывы данных.
- [x] Event journal и engineering console открываются на 1366×768 без document overflow.
- [x] HMI и уведомления содержат однозначные объект, расположение и `MONITOR_ID`.

## Hardware

- [ ] BOM, firmware и серийные номера зафиксированы.
- [x] Read-only FAT-инструмент и форма протокола подготовлены.
- [ ] Пройдены точки 4/12/20 мА.
- [ ] Проверены обрывы трёх петель.
- [ ] Пройден длительный Modbus-тест.

## Operations

- [x] Backup/restore проверен.
- [x] Документирован rollback.
- [x] InfluxDB retention принудительно установлен на 365 суток.
- [x] MAX retry проверен на mock после двух HTTP 500.
- [x] Software fault FAT: Modbus, InfluxDB и restart/recovery.
- [x] Persistent settings входят в Node-RED context и восстановлены из backup.
- [x] Годовая ёмкость рассчитана; зарезервировано требование 20 GiB для данных и 20 GiB для backup.
- [x] Repository и image dependency audit выполнены; critical vulnerabilities отсутствуют.
- [x] Локальные CycloneDX SBOM и Alpine inventory сформированы.
- [x] Shell/package syntax проверен внутри `debian:13-slim`.
- [x] Единый release-check проходит, а 24-часовой прогон отмечается отдельно.
- [ ] Пройден 24-часовой software endurance.
- [ ] Утверждены пороги.
- [ ] Выполнены security requirements на целевом Debian 13.
- [ ] Подписан протокол приёмки.
