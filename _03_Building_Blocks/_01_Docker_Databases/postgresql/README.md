# PostgreSQL

Relational (SQL) database with ACID transactions, joins and B-tree indexes.
See [databases](../../databases.md).

| | |
|---|---|
| Image | `postgres:17` |
| Port | `5432` |
| Container | `sd101-postgres` |

## 1. Create the `.env` file first

Docker won't start this database until a `.env` file exists in this folder
with the credentials filled in. Create `.env` with these lines:

```bash
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=sd101
POSTGRES_PORT=5432
```

Then fill in the blank values:

- `POSTGRES_USER`: the username to create (it becomes the superuser)
- `POSTGRES_PASSWORD`: the password for that user

The other values are defaults and can stay as they are.

- Credentials are set only on the **first** start. To change them later, run
  `docker compose down -v` (this deletes the data), update `.env`, and start again.
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
docker exec -it sd101-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Connection string: `postgresql://<user>:<password>@localhost:5432/sd101`

## Try it

```sql
CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT now());
INSERT INTO users (email) VALUES ('a@example.com'), ('b@example.com');
EXPLAIN SELECT * FROM users WHERE email = 'a@example.com';   -- uses the unique index
```
