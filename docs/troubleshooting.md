# Диагностика

| Симптом | Проверка | Возможная область |
|---|---|---|
| `docker` не найден | Новый terminal, Docker Desktop installation path, PATH | Установка хоста |
| Docker engine недоступен | Docker Desktop status, WSL status, logs | WSL2 backend |
| Node-RED unhealthy | `docker compose logs node-red` | Flow, settings, npm modules |
| InfluxDB unhealthy | `docker compose logs influxdb`, `/health` | Init variables, volumes |
| Unknown node types | Сравнить `package.json`, build log и palette | Image build |
| Modbus timeout | TCP 502, gateway, A/B/GND, Unit ID, serial framing | Сеть или RS-485 |
| Значение `32767` | Тип входа, токовая петля, scale registers | WB-MAI6 или датчик |
| История пустая | Bucket, token, org, measurement и tags | InfluxDB configuration |
| История обновилась один раз | Page event и trigger topology | Baseline flow |
| Старая норма после обрыва | Error branch, stale timeout, state context | Flow logic |

## Основные команды

```powershell
docker compose --env-file .env -f docker/compose.yaml ps
docker compose --env-file .env -f docker/compose.yaml logs --tail 300
docker inspect gas-monitoring-node-red-1
wsl --status
wsl --version
```

Не использовать удаление volumes как средство диагностики: сначала сохранить данные и установить причину.
