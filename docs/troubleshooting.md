# Диагностика

| Симптом | Проверка | Возможная область |
|---|---|---|
| `docker` не найден | Новый terminal, Docker Desktop installation path, PATH | Установка хоста |
| Docker engine недоступен | Docker Desktop status, WSL status, logs | WSL2 backend |
| Node-RED unhealthy | `docker compose logs node-red` | Flow, settings, npm modules |
| InfluxDB unhealthy | `docker compose logs influxdb`, `/health` | Init variables, volumes |
| Unknown node types | Сравнить `package.json`, build log и palette | Image build |
| Порог не сохраняется | `SERVICE_ACCESS_CODE`, срок разблокировки, порядок границ | Engineering console |
| Нет событий в журнале | Node-RED log, InfluxDB health, measurement `gas_event` | Event journal write/query |
| MAX показывает ошибку | `/dashboard/engineering`, `max-mock` или ответ реального API | MAX retry/delivery |
| Modbus timeout | TCP 502, gateway, A/B/GND, Unit ID, serial framing | Сеть или RS-485 |
| Значение `32767` | Тип входа, токовая петля, scale registers | WB-MAI6 или датчик |
| История пустая | Bucket, token, org, measurement и tags | InfluxDB configuration |
| История пустая при наличии текущих значений | Проверить `gas_pressure`, `_field=pressure_bar`, выбранный период | Query API или период |
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
