# Changelog

Все существенные изменения проекта документируются в этом файле.

## [Unreleased]

### Added

- Зафиксирован исходный экспорт `flows/flows.json` и его происхождение.
- Добавлена воспроизводимая Docker-архитектура Node-RED и InfluxDB.
- Добавлены статическая проверка и аудит структуры flow.
- Реализован продуктовый Modbus TCP flow для O₂, AIR и N₂O с Input Registers, валидацией, масштабированием и stale-контролем.
- Реализованы полноэкранный HMI и интерактивная история на FlowFuse Dashboard.
- Запись и чтение InfluxDB переведены на v2 HTTP API без credentials в flow.
- Добавлен отключённый по умолчанию стендовый генератор данных.
- Удалены legacy `node-red-dashboard` и `node-red-contrib-influxdb`; repository audit не содержит известных уязвимостей.
- Подтверждена совместимость с Node-RED 5.0.1 и Node.js 24 на закреплённом image digest.
