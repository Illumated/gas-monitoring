# 23. Runtime на Debian 13

Целевая production-платформа — Debian 13 amd64. Windows 10 и Docker Desktop используются только для разработки и FAT.

Полная установка с пустого накопителя описана в [02 — Заводская установка](02-заводская-установка.md). Она является штатным способом подготовки серийного устройства. Этот документ фиксирует уже установленный runtime.

## Сервисы

| Сервис | Назначение | Зависит от Salt |
|---|---|---|
| `gas-monitoring.service` | Запуск production Docker Compose | Нет |
| `nginx.service` | Удалённый HTTPS endpoint с auth-service | Нет |
| `lightdm.service` | Минимальная Openbox/Chromium kiosk-сессия | Нет |
| `nftables.service` | Доступ к `443/tcp` только через management LAN | Нет |
| `ssh.service` | Сервисный SSH-доступ пользователя `rinir` через management LAN | Нет |
| `salt-minion.service` | Последующие конфигурации и обновления | — |

`gas-monitoring.service` завершает запуск успешно только после прохождения healthcheck всех обязательных Compose-сервисов. Persistent-каталог `/data` в образе Node-RED принадлежит пользователю `node-red`; это проверяется при сборке и предотвращает restart loop из-за недоступного `flows.json`. Factory acceptance отдельно проверяет активный пользовательский сервис Chromium и процесс браузера, а не только `lightdm.service`.

Salt всегда установлен и включён, но не входит в dependency graph приложения. При отсутствии master мониторинг продолжает локальный запуск.

## Пути

```text
/opt/gas-monitoring/                         файлы release
/etc/gas-monitoring/gas-monitoring.env      product settings и secrets
/etc/gas-monitoring/factory-credentials.txt первичные root-only реквизиты
/etc/gas-monitoring/tls/                    certificate и private key
/etc/rinir-factory.env                      параметры двух LAN и Salt
/var/lib/rinir-factory/                     firstboot state и acceptance reports
Docker volume auth-data                     scrypt-хэши удалённых пользователей
```

Hostname имеет строгий формат `RINIR-XXXXXX`. Приложение читает его из `/etc/hostname` без преобразований. Название больницы и расположение задаются после запуска в разделе «Сервис».

## Локальная проверка

```bash
sudo systemctl status gas-monitoring.service nginx.service lightdm.service nftables.service ssh.service salt-minion.service
sudo docker compose \
  --env-file /etc/gas-monitoring/gas-monitoring.env \
  -f /opt/gas-monitoring/docker/compose.yaml \
  -f /opt/gas-monitoring/docker/compose.production.yaml \
  ps
curl --fail http://127.0.0.1:1880/dashboard/monitoring
curl --fail http://127.0.0.1:8086/health
sudo /opt/gas-monitoring/deploy/debian/acceptance.sh
```

Удалённый endpoint: `https://RINIR-XXXXXX/`. Доступ к Node-RED `1880` и InfluxDB `8086` через LAN запрещён.

Сервисный SSH доступен только через management LAN пользователю `rinir`. Root login запрещён. Пароль задаётся переменной `SSH_PASSWORD` в защищённом объектном `factory.env` и после ввода устройства в эксплуатацию должен быть сменён по принятой политике доступа.

Ручной online-скрипт `deploy/debian/install-docker-engine.sh` сохранён для ремонтной установки. Он требует явно заданных точных версий и не заменяет заводской offline bundle.
