# 03. Сеть

## Целевая схема стенда

| Узел | Интерфейс | Адрес | Маршрутизация |
|---|---|---|---|
| ПК | `rinir-mgmt` | DHCP основной сети | Единственный default route |
| ПК | `rinir-modbus` | `192.168.50.1/24` | Без gateway и DNS |
| USR-DR134 | Ethernet | `192.168.50.10/24` | Доступ только из Modbus-сегмента |
| WB-MAI6 | RS-485 | Unit ID определяется автоматически; заводской профиль — `65` | IP отсутствует |

Имена привязываются к MAC-адресам в `firstboot.sh`. При автоматическом выборе первый физический Ethernet-интерфейс становится management, второй — Modbus; при отличающейся аппаратной разводке имена явно задаются в `factory.env`.

## Локальная Docker-среда

- Node-RED: `127.0.0.1:1880`.
- InfluxDB: `127.0.0.1:8086`.
- Контейнеры используют Compose network `backend`.
- InfluxDB не публикуется на LAN.
- Modbus TCP `502/tcp` не публикуется контейнером и будет использоваться Node-RED как исходящее соединение.
- Удалённый dashboard публикуется как `443/tcp`, а сервисный SSH — как `22/tcp`; оба доступны только через `rinir-mgmt`.

## Проверки Debian-хоста

```bash
ip -br link
ip -br address
ip route
networkctl status rinir-mgmt
networkctl status rinir-modbus
nft list ruleset
ping -c 3 192.168.50.10
nc -vz -w 3 192.168.50.10 502
```

Критерий: `rinir-modbus` не получает default route, а `192.168.50.10:502` доступен после холодной перезагрузки. Полная автоматическая проверка: `deploy/debian/acceptance.sh`.
