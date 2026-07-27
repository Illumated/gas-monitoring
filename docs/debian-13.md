# Развёртывание на Debian 13

Целевая production-платформа — Debian 13 (Trixie). Windows 10 и Docker Desktop используются только для разработки и FAT.

## До установки

Зафиксировать:

- архитектуру CPU, RAM, накопитель и сетевые интерфейсы;
- пользователя kiosk-сессии и выбранное desktop environment;
- адреса management LAN и изолированного Modbus LAN;
- установленную версию Debian и пакетов;
- владельца обновлений, резервных копий и токенов.

## Docker Engine

Официальная инструкция Docker поддерживает Debian 13. Для production нельзя устанавливать неопределённый `latest`.

```bash
apt-cache madison docker-ce
apt-cache madison containerd.io
apt-cache madison docker-buildx-plugin
apt-cache madison docker-compose-plugin
export DOCKER_CE_VERSION='точная-версия-из-apt-cache'
export CONTAINERD_VERSION='точная-версия-из-apt-cache'
export DOCKER_BUILDX_VERSION='точная-версия-из-apt-cache'
export DOCKER_COMPOSE_VERSION='точная-версия-из-apt-cache'
sudo -E ./deploy/debian/install-docker-engine.sh
```

Выбранные версии заносятся в протокол развёртывания. Скрипт прекращает работу на системе, отличной от Debian 13.

## Установка приложения

```bash
sudo install -d -m 0755 /opt/gas-monitoring
sudo install -d -m 0700 /etc/gas-monitoring
sudo cp -a . /opt/gas-monitoring/
sudo cp .env.example /etc/gas-monitoring/gas-monitoring.env
sudo chmod 0600 /etc/gas-monitoring/gas-monitoring.env
sudo cp deploy/debian/gas-monitoring.service /etc/systemd/system/
```

Заполнить `/etc/gas-monitoring/gas-monitoring.env`. Обязательны уникальные секреты, bcrypt hash редактора Node-RED и фактические параметры Modbus.

```bash
cd /opt/gas-monitoring
sudo docker compose \
  --env-file /etc/gas-monitoring/gas-monitoring.env \
  -f docker/compose.yaml \
  -f docker/compose.production.yaml \
  config --quiet
sudo docker compose \
  --env-file /etc/gas-monitoring/gas-monitoring.env \
  -f docker/compose.yaml \
  -f docker/compose.production.yaml \
  build
sudo systemctl daemon-reload
sudo systemctl enable --now gas-monitoring.service
```

## Kiosk

После установки и проверки Chromium скопировать desktop-файл в профиль отдельного непривилегированного kiosk-пользователя:

```bash
install -d -m 0755 ~/.config/autostart
install -m 0644 /opt/gas-monitoring/deploy/debian/gas-monitoring-kiosk.desktop ~/.config/autostart/
```

Автовход и display manager зависят от выбранного desktop environment и настраиваются после обследования целевого компьютера. Kiosk-пользователь не включается в группу `docker` и не получает shell-доступ к `/etc/gas-monitoring/gas-monitoring.env`.

## Проверка

```bash
sudo systemctl status gas-monitoring.service
sudo docker compose --env-file /etc/gas-monitoring/gas-monitoring.env -f /opt/gas-monitoring/docker/compose.yaml -f /opt/gas-monitoring/docker/compose.production.yaml ps
curl --fail http://127.0.0.1:1880/
curl --fail http://127.0.0.1:8086/health
```

Официальный источник: [Install Docker Engine on Debian](https://docs.docker.com/engine/install/debian/).
