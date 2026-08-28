# 06. Автоматическая настройка WB-MAI6

В штатной заводской установке вручную вводить Unit ID и запусать `mbpoll` не нужно. На первой загрузке `gas-monitoring-hardware-autoconfigure.service`:

1. сканирует Unit ID `1…247` через `192.168.50.10:502`;
2. требует ровно один WB-MAI6 и не более одного WB-MR3LV/I;
3. настраивает IN1P…IN5P как `4–20 мА`, шкала `0…100`, а IN6P как сухой контакт;
4. назначает WB-MAI6 Unit ID `65`, опциональному WB-MR3LV/I — `66`;
5. переводит устройства на `115200 8N2`, согласованно возвращает USR-DR134 на тот же профиль;
6. перечитывает записанные регистры и только после успешной проверки сохраняет marker готовности.

Все запросы commissioning выполняются строго последовательно с паузой `300 ms`. Идентификация принимает строки модели `WBMAI6` и `WB-MAI6`, так как фактическая прошивка может возвращать имя без дефиса.

```bash
systemctl status gas-monitoring-hardware-autoconfigure.service --no-pager
journalctl -u gas-monitoring-hardware-autoconfigure.service -b --no-pager
ls -la /var/lib/rinir-factory/commissioning/
```

Поля Unit ID в «Сервис → Modbus-оборудование» меняют адреса опроса без перезапуска Node-RED. Они не перепрограммируют адрес в самом модуле.

Ниже оставлена ручная процедура для диагностики, замены или сброса WB-MAI6.

## Физические входы

WB-MAI6 имеет шесть нумерованных каналов `IN1…IN6`. В однополярном режиме каждый канал предоставляет входы `P` и `N`, поэтому карта содержит 12 независимо настраиваемых входов. Измерение 4–20 мА работает только в однополярном режиме. Если `INxP` переведён в дифференциальный режим, настройка `INxN` этого канала игнорируется.

Формулы для канала `X = 1…6`:

```text
INxP: type = 4096*X+1024, low = 4096*X+1032, high = 4096*X+1034, value = 4096*X+1284
INxN: type = 4096*X+1025, low = 4096*X+1033, high = 4096*X+1035, value = 4096*X+1285
```

## Полная карта 4–20 мА

| Канал | Вход | Тип, holding | Низ, holding | Верх, holding | Пересчитанное значение, input | Назначение проекта |
|---:|---|---:|---:|---:|---:|---|
| 1 | IN1P | 5120 | 5128 | 5130 | 5380 | O₂ |
| 1 | IN1N | 5121 | 5129 | 5131 | 5381 | Не назначено |
| 2 | IN2P | 9216 | 9224 | 9226 | 9476 | AIR |
| 2 | IN2N | 9217 | 9225 | 9227 | 9477 | Не назначено |
| 3 | IN3P | 13312 | 13320 | 13322 | 13572 | VAC |
| 3 | IN3N | 13313 | 13321 | 13323 | 13573 | Не назначено |
| 4 | IN4P | 17408 | 17416 | 17418 | 17668 | N₂O (профили 4/5) |
| 4 | IN4N | 17409 | 17417 | 17419 | 17669 | Не назначено |
| 5 | IN5P | 21504 | 21512 | 21514 | 21764 | CO₂ (профиль 5) |
| 5 | IN5N | 21505 | 21513 | 21515 | 21765 | Не назначено |
| 6 | IN6P | 25600 | 25608 | 25610 | 25860 | Обратная связь клапанов, сухой контакт (опция) |
| 6 | IN6N | 25601 | 25609 | 25611 | 25861 | Не назначено |

Для газовых входов `IN1P…IN5P` записываются: тип `4866` (`0x1302`), нижняя граница `0`, верхняя граница `100`. Runtime читает базовый 32-битный токовый регистр `0xX500`: менее `3.5 мА` — `НЕТ ДАННЫХ`, `3.5…4 мА` — `0.0 bar`, `4…20 мА` — линейный диапазон `0.0…10.0 bar`. Опциональный `IN6P` получает тип сухого контакта `5632` (`0x1600`): `0` — разомкнут/аварийный режим, `1` — замкнут/штатный режим.

Регистры границ имеют формат `16-bit signed int`. Соседние регистры `0xX409` и `0xX40B` относятся к входу `INxN`, а не являются второй половиной 32-битного значения. Их нельзя обнулять как «старшее слово».

## Порядок пусконаладки

1. Сверить модель, аппаратную ревизию, серийный номер и версию прошивки с паспортом.
2. Отключить запуск Node-RED, чтобы конфигурационный прогон не смешивался со штатным опросом.
3. Проверить питание, полярность токовых петель, RS-485 и адрес `65`.
4. Выполнить read-only снимок:

   На установленном RINIR-устройстве используется инструмент, уже включённый в product image; Node.js или `mbpoll` на host устанавливать не требуется:

   ```bash
   sudo install -d -m 0755 /var/lib/rinir-factory/commissioning
   sudo docker run --rm --network host \
     --volume /var/lib/rinir-factory/commissioning:/evidence \
     --entrypoint node gas-monitoring-node-red:0.1.0 \
     /usr/src/node-red/tools/wb-mai6-commission.mjs \
     --read-only --host 192.168.50.10 --unit 65 \
     --profile gas-monitoring --evidence /evidence
   ```

   На Windows и Debian при установленном Node.js:

   ```powershell
   node scripts/wb-mai6-commission.mjs --read-only --host 192.168.50.10 --unit 65 --profile gas-monitoring
   ```

   На Debian через `mbpoll`:

   ```bash
   WB_HOST=192.168.50.10 WB_UNIT_ID=65 WB_INPUTS=IN1P,IN2P,IN3P,IN4P,IN5P,IN6P ./scripts/wb-mai6-commission.sh --read-only
   ```

5. Проверить сохранённый файл в `commissioning-evidence/`.
6. Выполнить согласованную запись:

   На RINIR-устройстве:

   ```bash
   sudo docker run --rm --network host \
     --volume /var/lib/rinir-factory/commissioning:/evidence \
     --entrypoint node gas-monitoring-node-red:0.1.0 \
     /usr/src/node-red/tools/wb-mai6-commission.mjs \
     --apply --confirm APPLY --host 192.168.50.10 --unit 65 \
     --profile gas-monitoring --evidence /evidence
   ```

   ```powershell
   node scripts/wb-mai6-commission.mjs --apply --confirm APPLY --host 192.168.50.10 --unit 65 --profile gas-monitoring
   ```

7. `--apply` разрешён только с явным выбором `--profile`, `--inputs`, `--all-p` или `--all` и подтверждением `--confirm APPLY`. Профиль `gas-monitoring` пишет 4–20 мА/0…100 в IN1P…IN5P и сухой контакт `5632` в IN6P, затем проверяет чтение обратно.
8. Обесточить и включить модуль, затем повторить `--read-only`. Настройки должны сохраниться.
9. Подать эталонные 4, 12 и 20 мА на каждый газовый вход. Ожидаемые значения: `0`, `50`, `100`. Для IN6P отдельно проверить замыкание (`1`) и размыкание (`0`).
10. Только после этого запустить Node-RED и проверить `0.0`, `5.0`, `10.0 bar`, обрыв каждой петли и восстановление.

   ```bash
   sudo systemctl start gas-monitoring.service
   ```

## Ручная проверка

```bash
mbpoll -m tcp -a 65 -0 -r 5120  -c 1 -t 4 -o 3 -1 192.168.50.10
mbpoll -m tcp -a 65 -0 -r 5128  -c 1 -t 4 -o 3 -1 192.168.50.10
mbpoll -m tcp -a 65 -0 -r 5130  -c 1 -t 4 -o 3 -1 192.168.50.10
mbpoll -m tcp -a 65 -0 -r 5380  -c 1 -t 3 -o 3 -1 192.168.50.10
```

Для `IN2P` и `IN3P` используются адреса из таблицы выше. `32767` (`0x7FFF`) в пересчитанном input-регистре означает ошибку измерения, а не давление.

## Автоматизация

После клонирования репозитория один раз установить закреплённые зависимости:

```powershell
npm ci --cache .npm-cache
```

Показать карту всех 12 входов без подключения к оборудованию:

```powershell
node scripts/wb-mai6-commission.mjs --list
```

Прочитать все шесть входов `P`:

```powershell
node scripts/wb-mai6-commission.mjs --read-only --all-p
```

Настроить только четвёртый вход:

```powershell
node scripts/wb-mai6-commission.mjs --apply --confirm APPLY --inputs IN4P
```

Для `IN4P` автоматизатор использует:

```text
type=17408, low=17416, high=17418, value=17668
```

Настройка `--all` затрагивает 12 входов. Её можно применять только после документирования назначения всех клемм. Неиспользуемые входы автоматически не конфигурируются.

## Источники

- [Руководство WB-MAI6](https://wiki.wirenboard.com/wiki/WB-MAI6_Modbus_Analog_Inputs)
- [Карта Modbus-регистров WB-MAI6](https://wiki.wirenboard.com/wiki/WB-MAI6_Modbus_Registers)
