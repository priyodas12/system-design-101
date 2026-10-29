# RabbitMQ

Message broker: producers publish to exchanges, which route messages into queues, and each
message in a queue goes to one consumer. See [message queues](../../message-queues.md).

| | |
|---|---|
| Image | `rabbitmq:4.1-management` |
| Ports | `5672` (AMQP), `15672` (web UI) |
| Container | `sd101-rabbitmq` |

## 1. Create the `.env` file first

Docker won't start RabbitMQ until a `.env` file exists in this folder
with the credentials filled in. Create `.env` with these lines:

```bash
RABBITMQ_DEFAULT_USER=
RABBITMQ_DEFAULT_PASS=
RABBITMQ_PORT=5672
RABBITMQ_UI_PORT=15672
```

Then fill in the blank values:

- `RABBITMQ_DEFAULT_USER`: the admin username to create
- `RABBITMQ_DEFAULT_PASS`: the password for that admin

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

Web UI: <http://localhost:15672>. Log in with the username and password from `.env`.

Command line, from inside the container:

```bash
docker exec -it sd101-rabbitmq sh -c 'rabbitmqadmin --username "$RABBITMQ_DEFAULT_USER" --password "$RABBITMQ_DEFAULT_PASS" list queues'
```

Connection string: `amqp://<user>:<password>@localhost:5672/`

## Try it

Declare a durable queue, publish a message to it, then take it off the queue:

```bash
docker exec -it sd101-rabbitmq sh -c '
  A="rabbitmqadmin --username $RABBITMQ_DEFAULT_USER --password $RABBITMQ_DEFAULT_PASS"
  $A declare queue --name orders --durable true
  $A publish message --routing-key orders --payload order-1
  $A get messages --queue orders --count 1
'
```

The message is published to the default exchange, which routes it to the queue named by
the routing key. Open the **Queues** tab in the web UI to watch the message count change.
