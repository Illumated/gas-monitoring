# Эксплуатация

## Контроль состояния

```powershell
docker compose --env-file .env -f docker/compose.yaml ps
docker compose --env-file .env -f docker/compose.yaml logs --tail 200 node-red
docker compose --env-file .env -f docker/compose.yaml logs --tail 200 influxdb
```

Нормальное состояние:

- оба контейнера имеют статус `healthy`;
- Node-RED отвечает на `127.0.0.1:1880`;
- InfluxDB `/health` возвращает `pass`;
- dashboard явно показывает состояние каждого канала;
- ошибки Modbus не скрываются старым корректным значением.

## Перезапуск

```powershell
docker compose --env-file .env -f docker/compose.yaml restart
```

После перезапуска проверить health, startup logs, dashboard и наличие исторических данных.

## Изменение flow

1. Создать резервную копию.
2. Изменить `flows/flows.json` в отдельном Git-коммите.
3. Выполнить `npm test`.
4. Пересобрать Node-RED image.
5. Проверить логи и acceptance-сценарии.
6. Не изменять production flow только через UI без экспорта в Git.

## Обновление зависимостей

- Не изменять версии диапазонами.
- Проверить release notes.
- Обновить `package.json` и `package-lock.json`.
- Пересобрать image без cache.
- Выполнить regression tests и только затем развернуть.
