# Безопасность

## Секреты

В Git запрещены:

- `.env`;
- InfluxDB tokens и пароли;
- Node-RED credential secret;
- MAX tokens;
- cookie и экспортированные credentials-файлы.

Перед каждым коммитом выполняется value-oriented secret scan.

## Сетевой доступ

- Локальные Node-RED и InfluxDB привязаны к `127.0.0.1`.
- InfluxDB не публикуется в Modbus-сегмент.
- `502/tcp` доступен только с выделенного LAN2.
- LAN2 не получает default gateway.
- Удалённый доступ требует отдельной схемы authentication, TLS и firewall.

## Контейнеры

- Используются точные версии images.
- Включён `no-new-privileges`.
- Persistent data хранится в named volumes.
- Palette manager не используется для незафиксированных установок.
- Обновление выполняется через пересборку и проверенный rollback.

## Dependency audit

- `npm audit` выполняется для repository lockfile и собранного image.
- Транзитивный `lodash` закреплён безопасной версией через `overrides`.
- `npm audit fix --force` запрещён без анализа breaking changes.
- Оставшиеся upstream advisories Node-RED/Dashboard документируются в runtime-аудите и повторно проверяются перед production deployment.

## Открытые требования

До production deployment требуется определить:

- роли и владельцев доступа;
- политику паролей и ротации tokens;
- способ TLS termination;
- журналирование действий;
- обновление и rollback;
- допустимость Docker Desktop по корпоративной лицензии.
