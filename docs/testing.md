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
npm run audit:secrets
npm run capacity
docker compose --env-file .env -f docker/compose.yaml config
```

Физические тесты не заменяются симуляцией.

Аппаратный FAT, параметры команд и evidence описаны в `docs/hardware-fat.md`; подписываемая форма находится в `docs/hardware-fat-protocol.md`.

Полный software fault FAT:

```powershell
.\scripts\software-fat.ps1 -EnduranceMinutes 60
```

Скрипт проверяет MAX retry, потерю и восстановление Modbus, остановку и возврат InfluxDB, restart Node-RED без startup-спама и стабильный прогон. Для финального software soak используется `-EnduranceMinutes 1440`. Evidence сохраняется в `commissioning-evidence/`.

Полная проверка готовности выпуска, кроме отдельно согласованного 24-часового прогона:

```powershell
.\scripts\release-check.ps1
```
# Тестирование

## Автоматические проверки

```bash
npm test
docker compose --env-file .env -f docker/compose.yaml config --quiet
docker compose --profile fat --env-file .env -f docker/compose.yaml -f docker/compose.fat.yaml config --quiet
```

## Software FAT

FAT-профиль использует отдельный Modbus TCP server с Unit ID `65` и Input Registers `5380`, `9476`, `13572`.
Simulator также реализует конфигурационные holding-регистры всех 12 входов, поэтому на нём можно безопасно проверить `wb-mai6-commission.mjs` до работы с реальным модулем.

| Сценарий | Raw | Ожидание |
|---|---|---|
| `normal` | 50 / 52 / 48 | 5.0 / 5.2 / 4.8 bar, `ok` |
| `zero` | 0 / 0 / 0 | 0.0 bar, `alarm`, запись в историю |
| `warning` | 38 / 62 / 39 | 3.8 / 6.2 / 3.9 bar, `warn`, включая переход из `alarm` с гистерезисом |
| `oxygenalarm` | 20 / 52 / 48 | только O₂: 2.0 bar, `alarm`; AIR и N₂O остаются в `ok` |
| `alarm` | 20 / 80 / 70 | 2.0 / 8.0 / 7.0 bar, `alarm` |
| `nodata` | 32767 | `nodata`, значение не пишется в InfluxDB |

Сценарии `calibration4`, `calibration12` и `calibration20` выставляют для всех трёх входов raw `0`, `80` и `160`. Они нужны только для проверки процедуры `hardware-fat.mjs`; физическую точность тракта они не подтверждают.

Проверка reconnect:

1. Выполнить `docker pause gas-monitoring-modbus-simulator-1`. Контейнер сохраняет сетевой адрес, но перестаёт отвечать на Modbus.
2. Дождаться `GAS_STALE_TIMEOUT_MS`; экран должен показать `НЕТ ДАННЫХ`.
3. Выполнить `docker unpause gas-monitoring-modbus-simulator-1`.
4. Не выполнять Deploy и не перезапускать Node-RED.
5. Убедиться, что свежие точки всех трёх газов снова появились в InfluxDB.

Перед проверкой reconnect Dashboard должен не менее 30 секунд оставаться в `НОРМА` без промежуточных `НЕТ ДАННЫХ`. При работающем simulator любое такое переключение считается дефектом stale-контроля.

Один пустой ответ Modbus не меняет показание немедленно: канал переходит в `НЕТ ДАННЫХ`, только если возраст последнего корректного измерения превысил `GAS_STALE_TIMEOUT_MS`. Значения `32767`, `-32768` и другие явно некорректные данные обрабатываются сразу.

## Результат 2026-07-27

- все три контейнера healthy;
- все сценарии прошли через последовательный Modbus-опрос, а не через внутреннюю подстановку;
- runtime-flow содержит цикл `1000 ms`, задержку очереди `300 ms`; в InfluxDB измерен средний интервал `1000 ms` для каждого из трёх газов;
- после исправления stale-контроля Chrome выдержал 120 проверок за 36,6 секунды без единого ложного `НЕТ ДАННЫХ`;
- `pause` simulator перевёл каналы в `НЕТ ДАННЫХ` с сохранением времени последнего измерения, `unpause` восстановил `НОРМА` без Deploy и повторных скачков;
- `0.0 bar` сохранён как аварийное измерение;
- `32767` дал `nodata`;
- после `pause` simulator на время больше `GAS_STALE_TIMEOUT_MS` и последующего `unpause` свежие точки трёх каналов появились без Deploy;
- аппаратные проверки 4/12/20 мА, обрывы петель и длительный тест остаются обязательными на объекте.
- retention bucket автоматически подтверждён как `8760h`;
- история использует фактические пороги и разрывает линию при отсутствии данных;
- переходы состояния и изменения порогов сохраняются в отдельном журнале;
- MAX mock подтверждает повторную доставку после двух HTTP 500.
