# Docker Databases

Databases that run locally with Docker, so the ideas in [databases](../../_02_Fundamentals/databases.md),
[replication](../../_02_Fundamentals/replication.md) and
[sharding](../../_02_Fundamentals/sharding.md) can be tried hands-on.

| Database | Type | Image | Port | Fill in `.env` |
|---|---|---|---|---|
| [PostgreSQL](postgresql/) | Relational (SQL) | `postgres:17` | 5432 | `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| [MySQL](mysql/) | Relational (SQL) | `mysql:8.4` | 3306 | `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD` |
| [SQL Server](mssql/) | Relational (SQL) | `mssql/server:2022-CU16` | 1433 | `MSSQL_SA_PASSWORD` |
| [MongoDB](mongodb/) | Document | `mongo:7.0` | 27017 | `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` |
| [Redis](redis/) | Key-value (in-memory) | `redis:7.4` | 6379 | `REDIS_PASSWORD` |
| [Cassandra](cassandra/) | Wide-column | `cassandra:5.0` | 9042 | Nothing (no login) |

## How to run one

1. Go into the database's folder.
2. Create a `.env` file there and fill in the credentials. Each database's README lists
   exactly which lines to add. Docker won't start until they are filled in.
3. Run `docker compose up -d`.

`.env` files are ignored by Git, so credentials never leave your machine.

All six use their default ports, so they can run at the same time. If a port is already
taken on your machine, change it in that database's `.env`.

## Adding a new database

- One folder per database, named in kebab-case, containing `docker-compose.yml` and `README.md`.
- Pin the image version (e.g. `postgres:17`), never `latest`.
- Store data in a named volume.
- Read credentials from `.env` and make them required, e.g. `${DB_PASSWORD:?set DB_PASSWORD in .env}`.
  Never write a username or password in `docker-compose.yml` or a README.
- Use the database's default port and name the container `sd101-<database>`.
