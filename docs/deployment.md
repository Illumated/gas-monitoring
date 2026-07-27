# Развёртывание

## Требования

- Windows 10 Pro build 19045 для разработки либо Debian 13 для production;
- Docker Desktop с WSL2 backend либо Docker Engine;
- Docker Compose v2;
- свободные локальные порты 1880 и 8086;
- локальный `.env`, созданный из `.env.example`.

## Подготовка секретов

```powershell
Copy-Item .env.example .env
```

Заменить все значения `replace-with-*`. `.env` не добавляется в Git.

Для защиты Node-RED editor создать bcrypt hash:

```powershell
docker run --rm nodered/node-red:5.0.1-24 node-red admin hash-pw
```

Полученный hash записать в `NODE_RED_ADMIN_PASSWORD_HASH`. Пустое значение допускается только для loopback development-среды.

## Сборка и запуск

```powershell
docker compose --env-file .env -f docker/compose.yaml config
docker compose --env-file .env -f docker/compose.yaml build --pull
docker compose --env-file .env -f docker/compose.yaml up -d
docker compose --env-file .env -f docker/compose.yaml ps
```

## Проверка

```powershell
docker compose --env-file .env -f docker/compose.yaml logs --no-color node-red
docker compose --env-file .env -f docker/compose.yaml logs --no-color influxdb
Invoke-WebRequest http://127.0.0.1:1880/
Invoke-WebRequest http://127.0.0.1:8086/health
```

Dashboard:

```text
http://127.0.0.1:1880/dashboard/monitoring
http://127.0.0.1:1880/dashboard/history
```

## Стендовый прогон без оборудования

FAT-профиль запускает отдельный Modbus TCP simulator. Node-RED при этом продолжает использовать штатные `modbus-read` nodes:

```powershell
docker compose --profile fat --env-file .env `
  -f docker/compose.yaml `
  -f docker/compose.fat.yaml `
  up -d --build
```

Сценарии:

```powershell
Invoke-WebRequest -Method Post http://127.0.0.1:18080/scenario/zero
Invoke-WebRequest -Method Post http://127.0.0.1:18080/scenario/warning
Invoke-WebRequest -Method Post http://127.0.0.1:18080/scenario/alarm
Invoke-WebRequest -Method Post http://127.0.0.1:18080/scenario/nodata
Invoke-WebRequest -Method Post http://127.0.0.1:18080/scenario/normal
```

Симуляция не заменяет проверку USR-DR134, WB-MAI6 и токовых петель.

## Production

Debian 13, systemd, kiosk и production override описаны в [debian-13.md](debian-13.md). Первичная настройка оборудования выполняется по [wb-mai6-commissioning.md](wb-mai6-commissioning.md) до запуска Node-RED.

## Остановка

```powershell
docker compose --env-file .env -f docker/compose.yaml down
```

Команда не удаляет named volumes. Использовать `down --volumes` в обычной эксплуатации запрещено.
