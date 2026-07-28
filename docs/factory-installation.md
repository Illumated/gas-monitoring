# Заводская установка

## Результат

Заводской носитель устанавливает Debian 13 amd64 на пустое устройство, разворачивает приложение без доступа к Интернету и после двух автоматических перезагрузок открывает только Chromium с экраном:

```text
http://127.0.0.1:1880/dashboard/monitoring
```

Внутренние Node-RED и InfluxDB остаются привязаны к loopback. С другого компьютера в management LAN dashboard доступен через `https://RINIR-XXXXXX/` с отдельной HTTP Basic Authentication. На устройстве нет полноценного desktop environment: LightDM запускает сессию Openbox, а она — только Chromium kiosk.

> Заводской ISO без подтверждения удаляет разметку и данные на первом обнаруженном внутреннем non-removable диске. Съёмный USB-носитель исключается по признаку `/sys/block/*/removable`.

## Состав контура

| Файл | Назначение |
|---|---|
| `factory/versions.env` | Зафиксированные версии Debian, Docker Engine, Compose, containerd, Buildx и Salt |
| `factory/build-bundle.sh` | Собирает проверенный offline bundle: приложение, `.deb`, Docker images, manifest |
| `factory/build-iso.sh` | Встраивает preseed и bundle в официальный Debian DVD-1 ISO |
| `factory/preseed.cfg` | Полностью автоматическая установка Debian и очистка внутреннего диска |
| `factory/provision.sh` | Однократная настройка при первом запуске |
| `deploy/debian/firstboot.sh` | Hostname, два LAN и Salt minion ID |
| `deploy/debian/install-system.sh` | Секреты, systemd, kiosk, nginx и firewall |
| `deploy/debian/acceptance.sh` | Заводской приёмочный отчёт |

Используется DVD-1, а не netinst: netinst требует сетевого зеркала, тогда как базовая ОС и kiosk должны установиться автономно. Preseed помещается в initrd, поэтому Debian Installer читает его до интерактивных вопросов.

## Параметры устройства

Скопировать `deploy/debian/factory.env.example` вне репозитория:

```bash
cp deploy/debian/factory.env.example /secure/factory-RINIR.env
chmod 0600 /secure/factory-RINIR.env
```

Переменные:

| Переменная | Значение |
|---|---|
| `MANAGEMENT_INTERFACE` | Linux-имя физического LAN для больничной сети; пусто — первый интерфейс при сортировке имён |
| `MODBUS_INTERFACE` | Linux-имя физического LAN к TCP-RS485; пусто — второй интерфейс |
| `MANAGEMENT_DHCP` | Только `true`: адрес, gateway и DNS выдаёт DHCP |
| `MODBUS_ADDRESS` | Статический адрес ПК в изолированном сегменте, по умолчанию `192.168.50.1/24` |
| `MODBUS_DEVICE_ADDRESS` | Адрес TCP-RS485, по умолчанию `192.168.50.10` |
| `SALT_MASTER` | DNS/IP Salt master; пустое значение оставляет стандартное имя `salt` |
| `REMOTE_HTTPS_PORT` | Сейчас фиксировано `443` |
| `REMOTE_USER` | Логин удалённого чтения dashboard |
| `TZ` | Часовой пояс ОС и контейнеров |
| `INFLUXDB_RETENTION` | Срок хранения InfluxDB; `8760h` — один год |

При пустых именах интерфейсов установка требует ровно два физических Ethernet-адаптера. Выбранное соответствие MAC/роли записывается в `/var/lib/rinir-factory/firstboot.env`. При другом количестве интерфейсов provisioning останавливается, не назначая сеть по догадке.

## Сборка offline bundle

Сборочная машина: Debian 13 amd64/x86_64 с Git, Node.js, npm и Docker Engine, с доступом к Debian, Docker, Salt и container registries.

```bash
./factory/build-bundle.sh \
  /srv/rinir-build/factory \
  /secure/factory-RINIR.env
```

Скрипт:

1. требует чистый Git worktree и выполняет `npm test`;
2. собирает product image и получает pinned InfluxDB image;
3. экспортирует только состояние `HEAD`;
4. загружает pinned Docker `29.6.2`, containerd `2.2.6`, Buildx `0.35.0`, Compose `5.3.1` и Salt LTS `3008.2` вместе с зависимостями;
5. формирует `SHA256SUMS`.

Секретный `factory.env` включается в конкретный заводской образ, но не попадает в Git.

## Сборка ISO

Скачать официальный `debian-13.6.0-amd64-DVD-1.iso`, отдельно получить его SHA-256 из подписанного Debian `SHA256SUMS` и выполнить:

```bash
./factory/build-iso.sh \
  /srv/iso/debian-13.6.0-amd64-DVD-1.iso \
  <SHA256-ИЗ-DEBIAN> \
  /srv/rinir-build/factory \
  /srv/rinir-build/RINIR-13.6.0-amd64.iso
```

Рядом создаётся `RINIR-13.6.0-amd64.iso.sha256`. Перед записью на USB проверяются оба checksum: исходного Debian ISO и итогового RINIR ISO.

## Поведение устройства

1. Debian Installer находит первый internal non-removable disk и полностью переразмечает его.
2. После первого старта `factory-provision.service` проверяет manifest, ставит offline `.deb`, загружает Docker images и закрепляет пакеты через `apt-mark hold`.
3. `firstboot.sh` строит имя `RINIR-XXXXXX` из последних шести символов DMI UUID, а при его отсутствии — `machine-id`.
4. Management LAN получает DHCP и единственный default route; Modbus LAN получает статический адрес без gateway, DNS, RA и link-local.
5. Salt minion устанавливается и включается всегда. Недоступность master не влияет на `gas-monitoring.service`.
6. Генерируются уникальные secrets, bcrypt-пароли и самоподписанный TLS certificate. Root-only реквизиты записываются в `/etc/gas-monitoring/factory-credentials.txt`.
7. После второй перезагрузки запускаются Docker Compose, nginx, firewall, LightDM и Chromium kiosk.

Самоподписанный certificate не требует корпоративного CA. Удалённый браузер покажет предупреждение, пока certificate конкретного устройства не добавлен в доверенные. Salt позднее может заменить certificate, не меняя приложение.

## Приёмка

На готовом устройстве:

```bash
sudo /opt/gas-monitoring/deploy/debian/acceptance.sh
```

Проверяются Debian/architecture, hostname, обе сетевые роли, отсутствие default route на Modbus LAN, Salt, Docker, Compose, nginx, kiosk, firewall, health endpoints и отсутствие LAN-публикации портов `1880/8086`. Отчёт сохраняется в `/var/lib/rinir-factory/acceptance/`.

Проверка WB-MAI6 выполняется позднее по `docs/wb-mai6-commissioning.md` и не входит в offline OS installation.
