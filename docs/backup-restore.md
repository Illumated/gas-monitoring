# Резервное копирование и восстановление

## Состав резервной копии

- Git revision проекта;
- named volume `node-red-data`;
- named volume `influxdb-data`;
- named volume `influxdb-config`;
- локальный `.env`, сохранённый отдельно в защищённом хранилище.

Секреты не включаются в Git-архив.

## Правила

- Backup создаётся перед изменением flow, обновлением images и миграцией InfluxDB.
- Архив маркируется UTC-временем и Git commit SHA.
- Restore сначала проверяется в отдельном Compose project.
- Рабочие volumes не удаляются до проверки восстановленной копии.

## Проверка восстановления

1. Остановить тестовый Compose project.
2. Восстановить volumes под новыми именами.
3. Запустить containers с тем же Git revision.
4. Проверить health, dashboard, context и исторические точки.
5. Зафиксировать результат и длительность восстановления.

## Создание backup

```powershell
.\scripts\backup.ps1
```

На Debian 13:

```bash
./scripts/backup.sh
```

По умолчанию архивы создаются в `backups/<UTC timestamp>/`. Каталог исключён из Git.

Секреты не включаются. Для отдельной защищённой копии `.env`:

```powershell
.\scripts\backup.ps1 -IncludeSecrets
```

## Безопасное восстановление

Восстановление по умолчанию выполняется в новые volumes с другим Compose prefix:

```powershell
.\scripts\restore.ps1 `
  -BackupDirectory .\backups\<timestamp> `
  -TargetProjectName gas-monitoring-restore-test
```

Скрипт проверяет SHA-256 каждого архива. Если target volumes уже существуют, операция прекращается. `-ReplaceExisting` допускается только после отдельного подтверждения удаления конкретных target volumes.

На Debian восстановление также выполняется только в отсутствующие volumes:

```bash
./scripts/restore.sh ./backups/<timestamp> gas-monitoring-restore-test
```
