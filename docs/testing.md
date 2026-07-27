# Стратегия тестирования

## Уровни

1. Static: JSON, ID, wire references, syntax, secrets и Compose config.
2. Container: build, healthchecks, startup logs и persistence.
3. Flow: parsing, scale, invalid values, stale, hysteresis и state transitions.
4. Integration: Node-RED ↔ InfluxDB, restart и reconnect.
5. HMI: статусы, контраст и целевые разрешения.
6. Hardware: Modbus, токовые точки 4/12/20 мА и fault injection.
7. Acceptance: длительный прогон, backup/restore и протокол.

## Доказательства

Для каждого теста сохраняются:

- дата и Git commit;
- версия images;
- входные значения;
- ожидаемый и фактический результат;
- релевантные логи или скриншоты;
- итог pass/fail;
- известные ограничения.

## Запуск статической проверки

```powershell
npm test
npm run audit:flow
docker compose --env-file .env -f docker/compose.yaml config
```

Физические тесты не заменяются симуляцией.
