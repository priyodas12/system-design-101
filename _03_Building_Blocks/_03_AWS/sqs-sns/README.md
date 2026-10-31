# Amazon SQS + SNS (local emulator)

Small SQS and SNS clones in **one container with one AWS-console-style web UI**. Node.js,
**zero dependencies** (built-in `http` only), so the image builds in seconds. See
[message queues](../../../_02_Fundamentals/message-queues.md) for the concepts.

| | |
|---|---|
| Image | built from [`Dockerfile`](Dockerfile) (`node:22-alpine`) |
| Port | `9324` (UI and both APIs) |
| Container | `sd101-sqs-sns` |
| Storage | No database. State is in memory and snapshotted as JSON to `/data/state.json` (named volume `data`) every 2 s and on stop. Fine for study scale; not for large backlogs |

## Start and stop

```bash
docker compose up -d --build   # build and start
docker compose ps              # wait until "healthy"
docker compose down            # stop, keep queues and topics
docker compose down -v         # stop and delete everything
```

Port taken? `SQS_PORT=9400 docker compose up -d`.

## Use it

- **Console:** <http://localhost:9324>. Switch between **SQS** and **SNS** in the top bar.
- **AWS CLI / SDKs:** point both services at the same endpoint with any dummy credentials.

```bash
export AWS_ACCESS_KEY_ID=x AWS_SECRET_ACCESS_KEY=x AWS_DEFAULT_REGION=us-east-1
E="--endpoint-url http://localhost:9324"
aws $E sqs create-queue --queue-name orders-q
T=$(aws $E sns create-topic --name orders --query TopicArn --output text)
aws $E sns subscribe --topic-arn $T --protocol sqs --notification-endpoint arn:aws:sqs:us-east-1:000000000000:orders-q
aws $E sns publish --topic-arn $T --message '{"orderId":42}'
aws $E sqs receive-message --queue-url http://localhost:9324/000000000000/orders-q
```

```python
import boto3
kw = dict(endpoint_url="http://localhost:9324", region_name="us-east-1",
          aws_access_key_id="x", aws_secret_access_key="x")
sqs, sns = boto3.client("sqs", **kw), boto3.client("sns", **kw)
```

## What is supported

| Area | SQS | SNS |
|---|---|---|
| Operations | Create/Delete/List queues, GetQueueUrl, Get/SetQueueAttributes, Send/Receive/Delete (+ batch), ChangeMessageVisibility (+ batch), PurgeQueue, ListDeadLetterSourceQueues | Create/Delete/List topics, Get/SetTopicAttributes, Subscribe/Unsubscribe/ConfirmSubscription, List subscriptions (all / by topic), Get/SetSubscriptionAttributes, Publish, PublishBatch |
| Types | Standard and FIFO | Standard and FIFO (FIFO topics deliver to FIFO queues) |
| Behavior | Visibility timeout, delay, retention, long polling, dead-letter queues, message attributes + MD5 | Fan-out, JSON envelope vs raw delivery, filter policies (attributes and body scope: exact, prefix, suffix, anything-but, numeric, exists), per-protocol `MessageStructure=json` |
| Delivery targets | – | **sqs** (really delivered to the local queue), **http/https** (real POST with a subscription-confirmation handshake), **email / email-json / sms** (not sent: shown in the topic's *Delivery log*) |
| Protocol | AWS JSON (`X-Amz-Target`) | AWS query protocol (form in, XML out) and JSON |

**Not implemented:** SQS legacy query protocol (old SDKs), signature verification (any
credentials work), IAM/queue policies, encryption, tags, Lambda/Firehose/mobile-push targets,
SNS message signing (envelope has a dummy `Signature`), SNS retry/backoff policies, metrics.
Treat it as a learning tool, not a conformance-tested replacement; for that use LocalStack or ElasticMQ.

## Things to observe

1. **Visibility timeout:** poll a message in the SQS UI, poll again: it is "in flight" until the timeout expires.
2. **At-least-once:** don't delete a polled message; it reappears with a higher receive count.
3. **Dead-letter queue:** create `orders-dlq`, then `orders` with DLQ enabled and max receives `2`. Poll without deleting three times; the message moves to the DLQ.
4. **Long polling:** `--wait-time-seconds 5` on an empty queue returns as soon as a message arrives.
5. **SNS to SQS fan-out:** subscribe two queues to one topic, publish once, poll both queues. This is the classic "pub/sub in front of work queues" pattern.
6. **Envelope vs raw:** an SQS subscriber gets a JSON envelope (`Type`, `MessageId`, `Message`, …) unless *Raw message delivery* is on.
7. **Filter policy:** add `{"tier": ["gold"]}` to one subscription and publish with and without a `tier` attribute. Filtered deliveries show as `filtered` in the Delivery log.
8. **HTTP confirmation:** subscribe `http://host.docker.internal:8080/hook` (inside Docker, `localhost` is the container). Your endpoint receives a `SubscriptionConfirmation` POST; call its `SubscribeURL` to activate it.
