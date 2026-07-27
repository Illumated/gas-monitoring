# Acceptance checklist

## Build

- [ ] Images закреплены version и digest.
- [ ] `docker compose config` проходит.
- [ ] Build воспроизводится из чистого cache.
- [ ] Secret scan проходит.

## Runtime

- [ ] Node-RED healthy.
- [ ] InfluxDB healthy.
- [ ] Volumes сохраняются после restart.
- [ ] Startup logs не содержат unknown nodes.
- [ ] Dashboard routes открываются.

## Flow

- [ ] Три канала имеют документированное соответствие газам.
- [ ] Scaling подтверждён.
- [ ] Invalid values дают `НЕТ ДАННЫХ`.
- [ ] Stale timeout работает.
- [ ] Reconnect не требует ручного Deploy.

## HMI

- [ ] Четыре статуса различимы текстом.
- [ ] Общий статус однозначен.
- [ ] 1280×720, 1366×768 и 1920×1080 без scroll.
- [ ] `0.0 bar` не похоже на отсутствие данных.

## Hardware

- [ ] BOM, firmware и серийные номера зафиксированы.
- [ ] Пройдены точки 4/12/20 мА.
- [ ] Проверены обрывы трёх петель.
- [ ] Пройден длительный Modbus-тест.

## Operations

- [ ] Backup/restore проверен.
- [ ] Документирован rollback.
- [ ] Утверждены пороги.
- [ ] Выполнены security requirements.
- [ ] Подписан протокол приёмки.
