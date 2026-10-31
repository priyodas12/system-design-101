# Docker Message Brokers

Message brokers that run locally with Docker, so the ideas in
[message queues](../../_02_Fundamentals/message-queues.md) can be tried hands-on.

| Broker | Model | Image | Ports | Fill in `.env` |
|---|---|---|---|---|
| [Kafka](kafka/) | Partitioned event log (replayable) | `apache/kafka:4.0.0` | 9092 | Nothing (no login) |
| [RabbitMQ](rabbitmq/) | Queues and exchanges | `rabbitmq:4.1-management` | 5672, 15672 (web UI) | `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS` |

## How to run one

1. Go into the broker's folder.
2. Create a `.env` file there. Each broker's README lists exactly which lines to add.
   Docker won't start until it exists and any credentials are filled in.
3. Run `docker compose up -d`.

`.env` files are ignored by Git, so credentials never leave your machine.

Both use their default ports, so they can run at the same time as each other and as the
[databases](../_01_Docker_Databases/). If a port is already taken, change it in that
broker's `.env`.

## Adding a new broker

Follow the same rules as [Docker Databases](../_01_Docker_Databases/README.md#adding-a-new-database):
one folder per broker, pinned image version, named volume, required credentials read
from `.env`, default ports, and a container named `sd101-<broker>`.
