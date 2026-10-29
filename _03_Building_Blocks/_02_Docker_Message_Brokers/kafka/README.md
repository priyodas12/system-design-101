# Apache Kafka

Distributed event log: producers append messages to partitioned topics, and consumer groups
read them in order per partition and can replay them. See
[message queues](../../message-queues.md).

| | |
|---|---|
| Image | `apache/kafka:4.0.0` |
| Port | `9092` |
| Container | `sd101-kafka` |

Runs a single node in KRaft mode (no ZooKeeper), so every topic has one copy. It shows
topics, partitions and consumer groups, not replication.

## 1. Create the `.env` file first

Docker won't start Kafka until a `.env` file exists in this folder.
Create `.env` with this line (the default works as it is):

```bash
KAFKA_PORT=9092
```

- There is no username or password: this setup runs Kafka without login.
- Apps on your machine connect to `localhost:9092`. Tools inside the container use `kafka:19092`.

## 2. Start and stop

```bash
docker compose up -d        # start
docker compose ps           # wait until the status is "healthy"
docker compose down         # stop and keep the data
docker compose down -v      # stop and delete the data
```

## 3. Connect

Kafka's command-line tools are inside the container under `/opt/kafka/bin`:

```bash
docker exec -it sd101-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:19092 --list
```

From apps on your machine, use bootstrap server `localhost:9092`.

## Try it

Create a topic with 3 partitions, send two messages, then read them back:

```bash
docker exec sd101-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:19092 \
  --create --topic orders --partitions 3 --replication-factor 1

docker exec -it sd101-kafka /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server kafka:19092 --topic orders
# type a few lines, e.g. order-1 and order-2, then press Ctrl+C

docker exec -it sd101-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:19092 --topic orders --from-beginning --group billing
# press Ctrl+C to stop
```

Run the consumer again with the same `--group billing`: it reads nothing new, because
the group's offset has moved past those messages. Use a different group name and it
reads everything again. That's pub/sub through consumer groups.
