# Apache Cassandra

Wide-column (NoSQL) database built for huge write volume, with leaderless replication and tunable quorums.
See [databases](../../../_02_Fundamentals/databases.md#nosql-types) and [replication](../../../_02_Fundamentals/replication.md).

| | |
|---|---|
| Image | `cassandra:5.0` |
| Port | `9042` |
| Container | `sd101-cassandra` |

## 1. Create the `.env` file first

Docker won't start this database until a `.env` file exists in this folder.
Create `.env` with these lines (the defaults work as they are):

```bash
CASSANDRA_PORT=9042
CASSANDRA_CLUSTER_NAME=sd101
MAX_HEAP_SIZE=1G
HEAP_NEWSIZE=200M
```

- There is no username or password: this setup runs Cassandra without login.
- Lower `MAX_HEAP_SIZE` (e.g. `512M`) on a machine with little memory.
- It runs a single node, so it shows the data model, not replication. Allow about a minute for it to become healthy.

## 2. Start and stop

```bash
docker compose up -d        # start
docker compose ps           # wait until the status is "healthy"
docker compose down         # stop and keep the data
docker compose down -v      # stop and delete the data
```

## 3. Connect

```bash
docker exec -it sd101-cassandra cqlsh
```

Drivers connect to `localhost:9042`, datacenter `datacenter1`.

## Try it

Chat messages partitioned by conversation and sorted by time, as in the
[chat application](../../../_04_Case_Studies/chat-application.md) blueprint:

```sql
CREATE KEYSPACE sd101 WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
USE sd101;
CREATE TABLE messages (
  conversation_id UUID,
  sent_at TIMEUUID,
  sender TEXT,
  body TEXT,
  PRIMARY KEY ((conversation_id), sent_at)
) WITH CLUSTERING ORDER BY (sent_at DESC);
```
