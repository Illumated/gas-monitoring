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

## HMI

- [x] Четыре статуса заданы текстом независимо от цвета.
- [x] Общий статус имеет фиксированный приоритет.
- [x] 1280×720, 1366×768 и 1920×1080 без document/widget overflow.
- [x] `0.0 bar` отображается числом, отсутствие данных — знаком `—` и текстом.
- [x] History использует фактическую шкалу и пороги и показывает разрывы данных.
- [x] Event journal и engineering console открываются на 1366×768 без document overflow.

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
- [ ] Пройден 24-часовой software endurance.
- [ ] Утверждены пороги.
- [ ] Выполнены security requirements на целевом Debian 13.
- [ ] Подписан протокол приёмки.
