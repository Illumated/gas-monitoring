# Changelog

Все существенные изменения проекта документируются в этом файле.

## [Unreleased]

### Added

- Зафиксирован исходный экспорт `flows/flows.json` и его происхождение.
- Добавлена воспроизводимая Docker-архитектура Node-RED и InfluxDB.
- Добавлены статическая проверка и аудит структуры flow.
- Добавлен точечный override `lodash 4.18.1` для устранения high severity advisories в транзитивной зависимости `node-red-contrib-influxdb`.
- Начата проверка совместимости с Node-RED 5.0.1 и Node.js 24 на закреплённом image digest.
