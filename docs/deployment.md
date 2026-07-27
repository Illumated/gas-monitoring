# Развёртывание

## Требования

- Windows 10 Pro build 19045 или поддерживаемая Linux-система;
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

Dashboard baseline:

```text
http://127.0.0.1:1880/dashboard/monitoring
http://127.0.0.1:1880/dashboard/history
```

## Остановка

```powershell
docker compose --env-file .env -f docker/compose.yaml down
```

Команда не удаляет named volumes. Использовать `down --volumes` в обычной эксплуатации запрещено.
