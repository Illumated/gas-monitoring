# 02. Заводская установка

## Результат

Заводской носитель устанавливает Debian 13 amd64 на пустое устройство, разворачивает приложение без доступа к Интернету и после двух автоматических перезагрузок открывает только Chromium с экраном:

```text
http://127.0.0.1:1880/dashboard/monitoring
```

Внутренние Node-RED и InfluxDB остаются привязаны к loopback. С другого компьютера в management LAN dashboard доступен через `https://RINIR-XXXXXX/` с серверной проверкой логина и пароля. Пользователи управляются в сервисном UI, а пароли хранятся как `scrypt`-хэши. На устройстве нет полноценного desktop environment: LightDM запускает сессию Openbox, а она — только Chromium kiosk.

> Заводской ISO без подтверждения удаляет разметку и данные на первом обнаруженном внутреннем non-removable диске. Съёмный USB-носитель исключается по признаку `/sys/block/*/removable`.

## Состав контура

| Файл | Назначение |
|---|---|
| `factory/versions.env` | Зафиксированные версии Debian, Docker Engine, Compose, containerd, Buildx и Salt |
| `factory/build-bundle.sh` | Собирает проверенный offline bundle: приложение, `.deb`, Docker images, manifest |
| `factory/build-iso.sh` | Встраивает preseed и bundle в официальный Debian DVD-1 ISO |
| `factory/build-windows.ps1` | Единая точка запуска factory build на Windows |
| `factory/Dockerfile.windows-builder` | Закреплённая Linux-среда сборки внутри Docker Desktop |
| `factory/build-windows-container.sh` | Собирает bundle и ISO внутри factory builder |
| `factory/boot/grub.cfg` | Zero-touch UEFI boot, таймер и загрузка уже установленной RINIR-системы |
| `factory/boot/isolinux.cfg` | Zero-touch Legacy BIOS boot |
| `factory/preseed.cfg` | Полностью автоматическая установка Debian и очистка внутреннего диска |
| `factory/select-install-disk.sh` | Защита готовой установки и выбор внутреннего несъёмного диска |
| `factory/provision.sh` | Однократная настройка при первом запуске |
| `deploy/debian/firstboot.sh` | Hostname, два LAN и Salt minion ID |
| `deploy/debian/install-system.sh` | Секреты, systemd, kiosk, nginx и firewall |
| `deploy/debian/acceptance.sh` | Заводской приёмочный отчёт |
| `deploy/debian/gas-monitoring-acceptance.service` | Автоматический первый приёмочный прогон после загрузки |

Используется DVD-1, а не netinst: netinst требует сетевого зеркала, тогда как базовая ОС и kiosk должны установиться автономно. Debian Installer устанавливает с DVD задачу `standard`; пакеты продукта, которых нет на DVD-1, включая Chromium, nginx и `systemd-resolved`, заранее загружаются вместе с полным набором зависимостей в локальный APT repository `/factory/packages`. При первом запуске provisioning временно задаёт единственным APT source этот `file:` repository; сетевые sources в установке не участвуют. Preseed помещается одновременно в initrd и в корень ISO. Загрузчик явно передаёт `file=/cdrom/preseed.cfg`, а сборка распаковывает готовый ISO и проверяет оба экземпляра. Поэтому Debian Installer получает ответы до настройки пользователя и пароля, а целевому устройству не требуется Интернет.

Особенность Debian Installer: при `passwd/root-login=false` компонент `user-setup` принудительно включает создание обычного пользователя. Поэтому заводской preseed использует `passwd/root-login=true` вместе с блокирующим значением `passwd/root-password-crypted=*`, отключает создание обычного пользователя и повторно блокирует root в `late_command`. Доступного интерактивного root-пароля в установленной системе нет. Служебный `rinir-kiosk` создаётся позднее provisioning-скриптом и используется только для локального Chromium kiosk.

## Требования к Windows-сборочной машине

- Windows 10/11 x64;
- Git for Windows с доступной командой `git`;
- не менее `40 GB` свободного места на NTFS-диске;
- Docker Desktop, запущенный в режиме Linux containers;
- доступ к Debian, Docker Hub, Docker repository и Salt repository;
- репозиторий на локальном диске Windows, а не на сетевой SMB-папке.

Отдельная Debian-машина, Node.js, npm, `xorriso` и установленный вручную WSL distribution не требуются. Все Linux-инструменты выполняются внутри зафиксированных Docker-контейнеров.

Проект необходимо получить командой `git clone`. Архив GitHub `Download ZIP` не подходит: в нём нет `.git`, поэтому невозможно подтвердить чистоту исходников, экспортировать зафиксированный `HEAD` и записать commit в `BUILD-INFO.txt`.

```powershell
Set-Location C:\Users\user\Downloads
git clone https://github.com/Illumated/gas-monitoring.git
Set-Location .\gas-monitoring
```

## Параметры устройства

Скопировать `deploy/debian/factory.env.example` в защищённый каталог вне репозитория:

```powershell
New-Item -ItemType Directory -Path C:\RINIR-secure -Force
Copy-Item .\deploy\debian\factory.env.example C:\RINIR-secure\factory-RINIR.env
notepad.exe C:\RINIR-secure\factory-RINIR.env
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
| `ADMIN_ACCESS_CODE` | Уникальный код администрирования сервисного UI, не менее 10 символов |
| `NODE_RED_ADMIN_PASSWORD` | Уникальный пароль пользователя `admin` в Node‑RED editor, не менее 12 символов |
| `REMOTE_INITIAL_PASSWORD` | Уникальный начальный пароль `REMOTE_USER`, не менее 10 символов |
| `SSH_PASSWORD` | Уникальный пароль Linux-пользователя `rinir`, не менее 8 символов; SSH доступен только через management LAN |
| `TZ` | Часовой пояс ОС и контейнеров |
| `INFLUXDB_RETENTION` | Срок хранения InfluxDB; `8760h` — один год |

При пустых именах интерфейсов установка требует ровно два физических Ethernet-адаптера. Выбранное соответствие MAC/роли записывается в `/var/lib/rinir-factory/firstboot.env`. При другом количестве интерфейсов provisioning останавливается, не назначая сеть по догадке.

Для четырёх реквизитов допускаются только `A–Z`, `a–z`, `0–9` и символы `._@+-`. Пробелы, кавычки, `#`, `$` и обратная косая черта запрещены: `factory.env` является shell-конфигурацией.

## Штатная сборка RINIR ISO на Windows

### 1. Скачать исходный Debian ISO

С [официального каталога Debian amd64 DVD](https://cdimage.debian.org/debian-cd/current/amd64/iso-dvd/) скачать:

```text
debian-13.6.0-amd64-DVD-1.iso
```

### 2. Запустить единую сборку

PowerShell необходимо открыть в корне чистого репозитория. Каталог результата должен находиться вне репозитория и быть пустым:

```powershell
.\factory\build-windows.ps1 `
    -FactoryConfig C:\RINIR-secure\factory-RINIR.env `
    -SourceIso C:\RINIR-source\debian-13.6.0-amd64-DVD-1.iso `
    -OutputDirectory C:\RINIR-build\RINIR-13.6.0
```

Скрипт автоматически:

1. проверяет наличие `.git`, исходного Debian ISO и требует Docker Desktop `linux/amd64`;
2. собирает закреплённый factory builder и требует чистый Git worktree;
3. внутри builder выполняет `npm ci`, contract tests, flow audit, secret scan и dependency audit;
4. собирает product image и получает pinned InfluxDB image;
5. экспортирует в bundle только состояние `HEAD`;
6. скачивает pinned Docker, containerd, Compose, Buildx и Salt packages;
7. формирует и проверяет `SHA256SUMS` offline bundle;
8. восстанавливает boot metadata исходного Debian ISO и создаёт RINIR ISO;
9. повторно проверяет итоговый ISO и записывает `BUILD-INFO.txt` с Git commit.

Успешный результат:

```text
C:\RINIR-build\RINIR-13.6.0\RINIR-13.6.0-amd64.iso
C:\RINIR-build\RINIR-13.6.0\RINIR-13.6.0-amd64.iso.sha256
C:\RINIR-build\RINIR-13.6.0\BUILD-INFO.txt
Factory ISO created and verified
```

Сборка считается завершённой только после сообщения `Factory ISO created and verified`. Итоговый `.sha256` должен совпасть с повторным `Get-FileHash`; `BUILD-INFO.txt` должен содержать ожидаемый Git commit.

## Справочно: низкоуровневые Linux-команды

Оператор на Windows этот раздел не выполняет. Команды остаются для диагностики внутренней работы Windows-оркестратора и CI; штатная сборка устройства выполняется только предыдущим PowerShell-скриптом.

Сборочная среда: Debian 13 amd64/x86_64 с Git, Node.js, npm и Docker Engine.

### Сборка offline bundle

```bash
./factory/build-bundle.sh \
  /srv/rinir-build/factory \
  /secure/factory-RINIR.env
```

`build-bundle.sh`:

1. требует чистый Git worktree, выполняет `npm test`, flow audit, secret scan и dependency audit;
2. собирает product image и получает pinned InfluxDB image;
3. экспортирует только состояние `HEAD`;
4. загружает pinned Docker `29.6.2`, containerd `2.2.6`, Buildx `0.35.0`, Compose `5.3.1` и Salt LTS `3008.2` вместе с зависимостями;
5. формирует `SHA256SUMS`.

Секретный `factory.env` включается в конкретный заводской образ, но не попадает в Git. Четыре значения `replace-with-*` необходимо заменить до сборки: installer откажется продолжать с шаблонными или слишком короткими реквизитами. Для обслуживания создаётся Linux-пользователь `rinir` с `sudo`; root остаётся заблокирован, а SSH разрешён только через management LAN.

### Сборка ISO

Скачать официальный `debian-13.6.0-amd64-DVD-1.iso` и выполнить:

```bash
./factory/build-iso.sh \
  /srv/iso/debian-13.6.0-amd64-DVD-1.iso \
  /srv/rinir-build/factory \
  /srv/rinir-build/RINIR-13.6.0-amd64.iso
```

Рядом создаётся `RINIR-13.6.0-amd64.iso.sha256`. Исходный Debian ISO по SHA‑256 не проверяется. Итоговый checksum относится только к собранному RINIR ISO.

## Подготовка загрузочной флешки на Windows

Флешка подготавливается на том же Windows 10/11 после Docker-сборки автономного ISO. Исходный официальный `debian-13.6.0-amd64-DVD-1.iso` на стенд не устанавливает продукт. На USB необходимо записать именно дважды проверенный `RINIR-13.6.0-amd64.iso`.

### Требования

- USB-флешка объёмом не менее `16 GB` без нужных данных;
- Windows-учётная запись с правами администратора;
- `RINIR-13.6.0-amd64.iso` и соседний `RINIR-13.6.0-amd64.iso.sha256`;
- [balenaEtcher с официального сайта](https://etcher.balena.io/) — основной инструмент; Debian рекомендует его для записи образов из Windows, после записи выполняется validation.

Не использовать `unetbootin`, не распаковывать ISO на флешку и не копировать на неё файл `.iso` через Проводник. Для загрузки требуется запись образа на устройство целиком.

### 1. Проверить ISO

Открыть PowerShell в каталоге с обоими файлами:

```powershell
$isoPath = (Resolve-Path '.\RINIR-13.6.0-amd64.iso').Path
$checksumPath = "$isoPath.sha256"
$expected = ((Get-Content -LiteralPath $checksumPath -Raw) -split '\s+')[0].ToUpperInvariant()
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $isoPath).Hash.ToUpperInvariant()

if ($actual -ne $expected) {
    throw "SHA-256 не совпадает. Ожидался $expected, получен $actual"
}

"SHA-256 подтверждён: $actual"
```

Продолжать можно только после сообщения `SHA-256 подтверждён`. При несовпадении удалить ISO и повторить Windows-сборку из проверенного исходного Debian DVD.

### 2. Однозначно определить флешку

Подключить только одну USB-флешку и выполнить:

```powershell
Get-Disk |
    Sort-Object Number |
    Format-Table Number, FriendlyName, BusType,
        @{Name='SizeGB'; Expression={[math]::Round($_.Size / 1GB, 1)}},
        PartitionStyle
```

Сверить `FriendlyName`, `BusType=USB` и объём. Записать номер диска и модель в журнал работ.

**СТОП:** если целевую флешку нельзя однозначно отличить от внутренних дисков, запись не начинать.

### 3. Записать образ

1. Запустить balenaEtcher.
2. Нажать `Flash from file` и выбрать `RINIR-13.6.0-amd64.iso`.
3. Нажать `Select target`, выбрать флешку и сверить модель и объём с `Get-Disk`.
4. Нажать `Flash`, ещё раз проверить выбранное устройство и подтвердить полное удаление данных.
5. Дождаться окончания записи и проверки без ошибок.
6. Если Windows предлагает форматировать один из разделов — нажать `Отмена`. Форматирование уничтожит установочный носитель.
7. Закрыть balenaEtcher и выполнить безопасное извлечение флешки через область уведомлений Windows.

В качестве компактной альтернативы разрешён [USBImager](https://bztsrc.gitlab.io/usbimager/): использовать стандартную Windows-версию, выбрать образ и устройство, включить `Verify`, затем нажать `Write`. Для Rufus требуется именно `DD Image mode`; `ISO Image mode` применять нельзя.

### 4. Зафиксировать результат

В комплект объекта сохранить:

- имя ISO и подтверждённый SHA‑256;
- дату записи, модель и объём USB;
- название и версию программы записи;
- снимок успешного окончания записи/validation;
- Git commit, из которого собран ISO.

После записи файловая система флешки может отображаться в Windows не полностью. Это не является ошибкой, если поблочная запись и validation завершились успешно. Если раздел доступен в Проводнике, в корне должны находиться каталоги Debian и каталог `factory`; самого файла `RINIR-*.iso` в корне быть не должно.

### 5. Первая загрузка стенда

1. Полностью выключить целевой ПК.
2. Отсоединить все внутренние накопители, данные на которых нельзя уничтожить, и лишние USB-накопители.
3. Подключить management LAN. Modbus LAN на время установки оставить отключённым.
4. Подключить RINIR USB и включить ПК. Если USB не является первым загрузочным устройством, один раз открыть Boot Menu прошивки и выбрать запись вида `UEFI: <модель флешки>`.
5. Не нажимать клавиши: через 10 секунд автоматически запускается единственный пункт `RINIR automatic factory installation` с `auto=true priority=critical file=/cdrom/preseed.cfg`.
6. Если показано стандартное меню Debian с пунктом `Install` либо установщик спрашивает имя пользователя и пароль, это не штатный RINIR installer. Остановить установку и проверить SHA‑256 записанного ISO, режим записи флешки и строку `Git commit` в `BUILD-INFO.txt`.
7. Installer не запрашивает язык, раскладку, пользователя, hostname, сеть, разметку или устройство GRUB. Первый внутренний non-removable диск будет полностью очищен.

Для заводского режима «подключить флешку и включить питание» необходимо заранее установить USB первым в UEFI Boot Order. В конце установки создаётся `/var/lib/rinir-factory/install.done`. При следующей загрузке с флешки UEFI-меню на 30 секунд показывает два пункта: безопасную загрузку установленной системы, выбранную по умолчанию, и явное предупреждение `ВНИМАНИЕ: полностью стереть диск и переустановить RINIR`. Только второй пункт передаёт installer параметр `rinir_force_reinstall=true`; без него независимая проверка перед разметкой запрещает очистку диска с маркером `install.done`.

Полностью автономный цикл с оставленной флешкой поддерживается в режиме UEFI. В Legacy BIOS автоматическая первоначальная установка также работает, но носитель нужно выбрать через одноразовый Boot Menu либо извлечь перед первой перезагрузкой: ISOLINUX не умеет безопасно искать маркер на установленной ext4-системе и передавать ей управление. Если флешка останется первой в Legacy Boot Order, повторный installer обнаружит `install.done` и выключит устройство без очистки диска.

Если USB отсутствует в UEFI Boot Menu, сначала проверить запись на другом порту USB, отключить Fast Boot и проверить разрешение загрузки с USB. Secure Boot отключать только если прошивка явно отклоняет загрузчик; это отклонение необходимо зафиксировать в журнале работ.

## Поведение устройства

1. Загрузчик ждёт 10 секунд, проверяет наличие готовой RINIR-системы и только для нового устройства автоматически запускает Debian Installer.
2. Debian Installer без сетевой конфигурации находит первый internal non-removable disk и полностью переразмечает его.
3. После первого старта `factory-provision.service` проверяет manifest, ставит offline `.deb`, загружает Docker images и закрепляет пакеты через `apt-mark hold`.
4. `firstboot.sh` строит имя `RINIR-XXXXXX` из последних шести символов DMI UUID, а при его отсутствии — `machine-id`.
5. Management LAN получает DHCP и единственный default route; Modbus LAN получает статический адрес без gateway, DNS, RA и link-local.
6. Salt minion устанавливается и включается всегда. Недоступность master не влияет на `gas-monitoring.service`.
7. Внутренние secrets генерируются автоматически; администраторский код, пароль Node‑RED, начальный удалённый пароль и пароль SSH-пользователя `rinir` берутся из объектового `factory.env`. Самоподписанный TLS certificate создаётся на устройстве. Root-only копия реквизитов записывается в `/etc/gas-monitoring/factory-credentials.txt`.
8. После второй перезагрузки запускаются Docker Compose, nginx, firewall, LightDM и Chromium kiosk.

Самоподписанный certificate не требует корпоративного CA. Удалённый браузер покажет предупреждение, пока certificate конкретного устройства не добавлен в доверенные. Salt позднее может заменить certificate, не меняя приложение.

## Приёмка

После второй загрузки `gas-monitoring-acceptance.service` автоматически ждёт готовности HTTP endpoints и запускает проверку. Отчёт сохраняется в `/var/lib/rinir-factory/acceptance/`, а успешное завершение отмечается файлом `initial.pass`. Проверить результат через Salt:

```bash
systemctl status gas-monitoring-acceptance.service --no-pager
ls -l /var/lib/rinir-factory/acceptance/
```

Для повторного ручного запуска через Salt или сервисную сессию:

```bash
sudo /opt/gas-monitoring/deploy/debian/acceptance.sh
```

Проверяются Debian/architecture, hostname, обе сетевые роли, отсутствие default route на Modbus LAN, Salt, Docker, Compose, nginx, kiosk, firewall, health endpoints и отсутствие LAN-публикации портов `1880/8086`. Отчёт сохраняется в `/var/lib/rinir-factory/acceptance/`.

После второй загрузки `gas-monitoring-hardware-autoconfigure.service` сканирует Unit ID `1…247`, настраивает единственный WB-MAI6 и сохраняет найденные Unit ID. Допустимы ровно один WB-MAI6 и ноль или один WB-MR3LV/I. Evidence сохраняется в `/var/lib/rinir-factory/commissioning/`.

Если шлюз или WB-MAI6 недоступен, Dashboard запустится с состоянием «НЕТ ДАННЫХ». Причина видна в `journalctl -u gas-monitoring-hardware-autoconfigure.service -b`.

## Официальные источники версий

- [Debian 13.6 point release](https://www.debian.org/News/2026/20260711)
- [Debian FAQ: запись установочного образа на USB из Windows](https://www.debian.org/CD/faq/#write-usb)
- [Debian Installer: USB-носитель из hybrid ISO](https://d-i.debian.org/doc/installation-guide/en.amd64/ch04s03.html)
- [Docker packages for Debian 13 (trixie), amd64](https://download.docker.com/linux/debian/dists/trixie/pool/stable/amd64/)
- [Salt Project downloads and current LTS](https://docs.saltproject.io/salt/install-guide/en/latest/topics/downloads.html)
- [Salt installation on Debian](https://docs.saltproject.io/salt/install-guide/en/latest/topics/install-by-operating-system/linux-deb.html)
