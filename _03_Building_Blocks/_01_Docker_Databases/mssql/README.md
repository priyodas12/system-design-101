# Microsoft SQL Server

Relational (SQL) database from Microsoft, running the free Developer edition.
See [databases](../../databases.md).

| | |
|---|---|
| Image | `mcr.microsoft.com/mssql/server:2022-CU16-ubuntu-22.04` |
| Port | `1433` |
| Container | `sd101-mssql` |

## 1. Create the `.env` file first

Docker won't start this database until a `.env` file exists in this folder
with the credentials filled in. Create `.env` with these lines:

```bash
MSSQL_SA_PASSWORD=
MSSQL_PORT=1433
```

Then fill in the blank values:

- `MSSQL_SA_PASSWORD`: the password for SQL Server's built-in admin login

The other values are defaults and can stay as they are.

- SQL Server doesn't let you choose the admin username here; you only set its password.
- The password needs at least 8 characters and 3 of these 4: uppercase, lowercase, digits, symbols. If it's too weak, the container starts and then exits; check `docker compose logs mssql`.
- Credentials are set only on the **first** start. To change them later, run
  `docker compose down -v` (this deletes the data), update `.env`, and start again.
- Needs at least 2 GB of RAM and an x86-64 (amd64) machine. Starting it accepts the SQL Server EULA.
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
docker exec -it sd101-mssql sh -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C'
```

`sa` is SQL Server's built-in admin login. `-C` trusts the container's self-signed certificate.

Connection string: `Server=localhost,1433;User Id=sa;Password=<password>;TrustServerCertificate=True`

## Try it

```sql
CREATE DATABASE sd101;
GO
USE sd101;
CREATE TABLE products (id INT IDENTITY PRIMARY KEY, name NVARCHAR(100), price DECIMAL(10,2));
INSERT INTO products (name, price) VALUES (N'Keyboard', 49.00), (N'Mouse', 19.00);
SELECT * FROM products;
GO
```
