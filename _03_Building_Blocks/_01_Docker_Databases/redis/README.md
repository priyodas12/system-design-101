# Redis

In-memory key-value store, used as a cache, session store, rate-limit counter and more.
See [cache](../../../_02_Fundamentals/cache.md) and [rate limiting](../../../_02_Fundamentals/rate-limiting.md).

| | |
|---|---|
| Image | `redis:7.4` |
| Port | `6379` |
| Container | `sd101-redis` |

## 1. Create the `.env` file first

Docker won't start this database until a `.env` file exists in this folder
with the credentials filled in. Create `.env` with these lines:

```bash
REDIS_PASSWORD=
REDIS_PORT=6379
```

Then fill in the blank values:

- `REDIS_PASSWORD`: the password clients must use to connect

The other values are defaults and can stay as they are.

- Redis has no username in this setup, only a password.
- The password is read on every start: to change it, edit `.env` and run `docker compose up -d` again. No data is lost.
- Append-only file (AOF) persistence is on, so data survives restarts.
- `.env` is ignored by Git, so it stays on your machine only.

## 2. Start and stop

```bash
docker compose up -d        # start
docker compose ps           # wait until the status is "healthy"
docker compose down         # stop and keep the data
docker compose down -v      # stop and delete the data
```

## 3. Connect

```bash
docker exec -it sd101-redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning'
```

Connection string: `redis://:<password>@localhost:6379/0`

## Try it

```
SET user:42 '{"name":"Ada"}' EX 600     # cache-aside entry with a 10-minute TTL
TTL user:42
INCR rate:user:42                       # simple fixed-window counter
EXPIRE rate:user:42 60
```
