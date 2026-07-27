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
node-red-contrib-influxdb 0.7.0
node-red-contrib-modbus 5.45.2
node-red-dashboard 3.6.6
```

## Проверки

| Проверка | Результат |
|---|---|
| Compose config | PASS |
| Node-RED image build | PASS |
| Node-RED healthcheck | PASS |
| InfluxDB healthcheck | PASS |
| `/dashboard/monitoring` | HTTP 200 |
| `/dashboard/history` | HTTP 200 |
| Flow hash в `/data/flows.json` | Совпадает с `B51B…EB57` |
| InfluxDB initialization | org `rinir`, bucket `wb` |
| Test point before restart | Найдена |
| Test point after full container restart | Найдена |
| Named volume persistence | PASS |
| Backup трёх volumes без секретов | PASS |
| Проверка SHA-256 архивов | PASS |
| Restore в отдельные test volumes | PASS |
| Hash восстановленного flow | Совпадает с `B51B…EB57` |
| Node-RED 5.0.1 compatibility | Flow и оба dashboard modules загружаются |
| Repository package audit | 0 vulnerabilities |
| Built image audit | 49 warnings: 42 high, 5 moderate, 2 low, 0 critical |

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

## Dependency risk

`node-red-contrib-influxdb@0.7.0` зависел от уязвимой ветки `lodash 4.17.x`. В product image применён точечный override `lodash 4.18.1`; repository package audit после этого показывает 0 vulnerabilities.

Полный audit собранного Node-RED 5.0.1 image по-прежнему сообщает upstream warnings в зависимостях Node-RED и Dashboard: 49 total, 42 high, без critical. Автоматический `npm audit fix --force` не применяется, потому что он меняет совместимые версии без контроля и предлагает breaking downgrades. Риск ограничен loopback-публикацией, обязательной authentication, выключенным palette install и pinned image digest. Перед production deployment требуется повторный audit доступной версии и review оставшихся advisory.

## Граница результата

Локальная контейнерная инфраструктура работоспособна и сохраняет данные. Исходный flow импортируется, но имеет config dependency defect и не считается рабочим измерительным flow.
