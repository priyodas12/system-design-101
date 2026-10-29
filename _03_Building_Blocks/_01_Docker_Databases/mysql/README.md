# MySQL

Relational (SQL) database using the InnoDB engine, with ACID transactions and B-tree indexes.
See [databases](../../databases.md).

| | |
|---|---|
| Image | `mysql:8.4` |
| Port | `3306` |
| Container | `sd101-mysql` |

## 1. Create the `.env` file first

Docker won't start this database until a `.env` file exists in this folder
with the credentials filled in. Create `.env` with these lines:

```bash
MYSQL_ROOT_PASSWORD=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=sd101
MYSQL_PORT=3306
```

Then fill in the blank values:

- `MYSQL_ROOT_PASSWORD`: the password for MySQL's built-in admin account
- `MYSQL_USER`: the username to create for everyday use (pick a new name, not the built-in admin account)
- `MYSQL_PASSWORD`: the password for that user

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
docker exec -it sd101-mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

Connection string: `mysql://<user>:<password>@localhost:3306/sd101`

## Try it

```sql
CREATE TABLE orders (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, total DECIMAL(10,2), INDEX idx_user (user_id));
INSERT INTO orders (user_id, total) VALUES (1, 19.99), (1, 5.00), (2, 42.00);
EXPLAIN SELECT * FROM orders WHERE user_id = 1;   -- uses idx_user
```
