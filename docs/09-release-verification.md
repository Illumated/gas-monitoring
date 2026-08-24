# 09. Проверка готовности выпуска

Единая проверка без физического WB-MAI6:

```powershell
.\scripts\release-check.ps1
```

Она выполняет:

1. все программные contract tests;
2. аудит структуры flow;
3. value-oriented поиск секретов;
4. расчёт годовой ёмкости;
5. `git diff --check`;
6. syntax-check всех PowerShell-скриптов, включая Windows factory builder;
7. repository dependency audit с блокировкой critical-уязвимостей;
8. проверку base, FAT и production Compose;
9. сборку Windows factory builder и его доступ к Docker Desktop engine;
10. наличие собранного product image;
11. локальные CycloneDX SBOM, Alpine inventory и npm audit собранного image;
12. syntax-check application, Debian deployment и factory shell-скриптов в контейнере Debian 13.

Результат сохраняется в `commissioning-evidence/release-check-<UTC>.json`. Каталог не входит в Git, так как содержит сведения конкретного прогона.

Image audit блокирует выпуск при любой `critical` npm-уязвимости. Предупреждения меньшего уровня не скрываются: итог образа получает `PASS_WITH_REVIEW`, а полный JSON сохраняется рядом с SBOM. Перед каждым выпуском инженер обязан просмотреть этот список и зафиксировать решение; `PASS_WITH_REVIEW` не означает отсутствие известных уязвимостей.

Проверка не заменяет:

- 24-часовой endurance;
- аппаратные точки 4/12/20 мА;
- обрыв токовых петель;
- длительный тест реального Modbus;
- security и kiosk-проверку на целевом Debian 13;
- загрузку собранного destructive ISO в чистой amd64 VM;
- подписанный протокол приёмки.
