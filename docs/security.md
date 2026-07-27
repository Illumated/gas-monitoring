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
- Legacy `node-red-dashboard` и `node-red-contrib-influxdb` удалены из product image.
- Repository lockfile audit после удаления legacy-зависимостей: `0` известных уязвимостей.
- Токен InfluxDB читается из environment только при формировании HTTP-запроса и не хранится в flow credentials.
- Токен MAX читается из environment, передаётся в `Authorization` и не сохраняется в flow или Git.
- Изменение порогов закрыто `SERVICE_ACCESS_CODE`, ограничено по времени и журналируется с именем исполнителя.
- Пустой `SERVICE_ACCESS_CODE` оставляет инженерную страницу в режиме только чтения.

## Открытые требования

До production deployment требуется определить:

- роли и владельцев доступа;
- политику паролей и ротации tokens;
- способ TLS termination;
- журналирование действий;
- обновление и rollback;
- правила firewall на целевом Debian 13;
- desktop environment и политика kiosk-автовхода.

Сервисный код защищает от случайного изменения на локальном kiosk, но не заменяет TLS и полноценную аутентификацию при удалённом доступе.
