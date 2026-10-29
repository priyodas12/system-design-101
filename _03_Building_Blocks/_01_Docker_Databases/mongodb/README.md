# MongoDB

Document (NoSQL) database with flexible JSON-like documents, good for catalogs and profiles.
See [databases](../../databases.md#nosql-types).

| | |
|---|---|
| Image | `mongo:7.0` |
| Port | `27017` |
| Container | `sd101-mongodb` |

**Why 7.0 and not 8.0:** MongoDB 8.0 and newer refuse to start on Linux kernels 6.19 through
7.0.13 because of a known crash ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912),
[SERVER-125742](https://jira.mongodb.org/browse/SERVER-125742)). MongoDB 7.0 works on every kernel.
Once your kernel is 7.0.14 or newer (`uname -r`), you can switch the image to `mongo:8.0`, but
run `docker compose down -v` first: 7.0 and 8.0 data files aren't interchangeable.

## 1. Create the `.env` file first

Docker won't start this database until a `.env` file exists in this folder
with the credentials filled in. Create `.env` with these lines:

```bash
MONGO_INITDB_ROOT_USERNAME=
MONGO_INITDB_ROOT_PASSWORD=
MONGO_PORT=27017
```

Then fill in the blank values:

- `MONGO_INITDB_ROOT_USERNAME`: the admin username to create
- `MONGO_INITDB_ROOT_PASSWORD`: the password for that admin

The other values are defaults and can stay as they are.

- The admin is created in the `admin` database, so clients need `authSource=admin`.
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
docker exec -it sd101-mongodb sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD"'
```

Connection string: `mongodb://<user>:<password>@localhost:27017/?authSource=admin`

## Try it

```js
use sd101
db.products.insertMany([
  { name: "Keyboard", price: 49, tags: ["usb", "mechanical"] },
  { name: "Mouse", price: 19, specs: { dpi: 1600 } }      // different shape, same collection
])
db.products.createIndex({ name: 1 })
db.products.find({ price: { $lt: 30 } })
```
