# Runtime-аудит локальной Docker-среды

Дата: 27.07.2026.

## Хост

| Параметр | Фактическое значение |
|---|---|
| OS | Windows 10 Pro, build 19045, x64 |
| CPU | Intel Core i3-14100, 8 logical CPU |
| RAM | 15,8 GiB physical |
| WSL | 2.7.10.0, default version 2 |
| Docker Desktop | 4.83.0, per-user, WSL2 backend |
| Docker Engine | 29.6.2, Linux x86_64 |

## Images

| Компонент | Version | Digest |
|---|---|---|
| Node-RED initial baseline test | `nodered/node-red:4.1.10-22` | `sha256:9292a793cc76ae00416a3b971e98448523797f1955485c9b9671379af58328ba` |
| Node-RED selected runtime | `nodered/node-red:5.0.1-24` | `sha256:6cb1b27fa5a83deec6a662db62eec8bb32e55ac5412d6b7a653e874ce62055d5` |
| InfluxDB | `influxdb:2.7.12` | `sha256:b8d940ca9376f85118260f5b6bd236b8a00b1749c3350c5578d4cde8e27f31f2` |

Фактически установленные Node-RED modules:

```text
@flowfuse/node-red-dashboard 1.30.2
node-red-contrib-modbus 5.45.2
```

## Проверки

| Проверка | Результат |
|---|---|
| Compose config | PASS |
| Node-RED image build | PASS |
| Node-RED build `--no-cache --pull` | PASS |
| Node-RED healthcheck | PASS |
| InfluxDB healthcheck | PASS |
| `/dashboard/monitoring` | HTTP 200 |
| `/dashboard/history` | HTTP 200 |
| Исходный flow | Зафиксирован первым Git-коммитом, hash `B51B…EB57` |
| Product flow startup | PASS, circular dependency отсутствует |
| Product Modbus profile | TCP, Unit ID 65, Input Register 5380/9476/13572 |
| InfluxDB initialization | org `rinir`, bucket `wb` |
| Test point before restart | Найдена |
| Test point after full container restart | Найдена |
| Named volume persistence | PASS |
| Backup трёх volumes без секретов | PASS |
| Проверка SHA-256 архивов | PASS |
| Restore в отдельные test volumes | PASS |
| Product flow static contract | PASS, 25 объектов и 25 уникальных ID |
| Node-RED 5.0.1 compatibility | Flow и оба dashboard modules загружаются |
| Repository package audit | 0 vulnerabilities |
| Built image audit | 49 warnings: 42 high, 5 moderate, 2 low, 0 critical |
| Product dashboard routes | monitoring HTTP 200, history HTTP 200 |
| Simulation write pipeline | По 8 точек O₂, AIR и N₂O за проверочный интервал |
| Product backup manifest | Git `9942fbf9d40fb2ced8cce55ab0a917ffd4be99c3`, 3 архива, без секретов |
| Product restore flow hash | `A08818DE133B34485F12CC6943142343C6F5E0B6C2143503172AE8CDBE331E4B`, совпадает с source |
| Product restore InfluxDB data | 27 engine files, PASS |

## Подтверждённые runtime-дефекты baseline

Node-RED воспроизводимо сообщает:

```text
Error: Circular config node dependency detected: modbus-client
```

Следовательно, ранее заявленный дефект является подтверждённым для переданного `flows/flows.json` в чистой среде.

Дополнительно подтверждено:

- одновременно загружаются legacy Dashboard 3.6.6 (`/ui`) и FlowFuse Dashboard 1.30.2 (`/dashboard`);
- credentials-файл в исходном экспорте отсутствует;
- dashboard routes создаются, но это не подтверждает работу измерительного pipeline;
- physical Modbus и датчики в локальном тесте не проверялись.

## Продуктовый прогон

После замены flow Node-RED запускается без circular dependency, unknown nodes и syntax errors. Оба контейнера получают статус `healthy`. Стендовый режим сформировал значения всех трёх каналов, а read-only Flux-запрос подтвердил отдельные серии `oxygen`, `air` и `n2o`.

Backup продуктового состояния создан в `backups/product-acceptance-9942fbf`. Все три архива восстановлены в отдельные volumes, их checksum проверены, hash восстановленного flow совпал с рабочим файлом, InfluxDB engine-файлы присутствовали. После проверки только временные restore volumes удалены; backup сохранён. Runtime возвращён в `SIMULATION_MODE=false`.

После подключения ChatGPT Chrome Extension выполнена фактическая браузерная приёмка. Первичный снимок 1366×768 обнаружил внутренний `ui-template` wrapper высотой 320 px при HMI высотой 720 px. Wrapper FlowFuse переведён на viewport-зависимую высоту и одну grid-строку. После исправления проверены:

- 1280×720: document 720 px, widget/HMI 672 px, overflow отсутствует;
- 1366×768: document 768 px, widget/HMI 720 px, карточки 542 px, overflow отсутствует;
- 1920×1080: document 1080 px, widget/HMI 1032 px, overflow отсутствует;
- history 1366×768: widget/HMI 720 px, точки отображаются;
- переключение history с O₂ на AIR: PASS, выбор и данные обновились.

## Dependency risk

Legacy `node-red-contrib-influxdb` и `node-red-dashboard` удалены из product image. Доступ к InfluxDB реализован штатными HTTP request nodes, токен поступает только из environment. Repository package audit показывает 0 vulnerabilities.

Полный audit собранного Node-RED 5.0.1 image по-прежнему сообщает upstream warnings в зависимостях Node-RED и Dashboard: 49 total, 42 high, без critical. Автоматический `npm audit fix --force` не применяется, потому что он меняет совместимые версии без контроля и предлагает breaking downgrades. Риск ограничен loopback-публикацией, обязательной authentication, выключенным palette install и pinned image digest. Перед production deployment требуется повторный audit доступной версии и review оставшихся advisory.

## Граница результата

Локальная контейнерная инфраструктура и product flow работоспособны, сохраняют данные и проходят автоматические и браузерные проверки. В штатном режиме без подключённого стенда ожидаемо зафиксирован `ECONNREFUSED 192.168.50.10:502`, и каналы переходят в `НЕТ ДАННЫХ`. До ввода на объекте остаются аппаратная проверка Modbus/4–20 mA, утверждение клинических порогов и финальный осмотр на физическом целевом мониторе.
