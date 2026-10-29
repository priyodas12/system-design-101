# Message Queues and Event Streaming

## TL;DR
Use synchronous calls when the caller needs the answer now. Use a queue or event stream to
decouple services, absorb traffic spikes and run background work.

## Sync vs async
| Style | Examples | Use when |
|-------|----------|----------|
| Sync | REST, gRPC | The caller needs the answer now |
| Async | Kafka, RabbitMQ, Azure Service Bus, AWS SQS (Simple Queue Service) | Decoupling services, absorbing spikes, long-running background work |

See [API design](../_02_Fundamentals/api-design.md) for REST, gRPC and WebSocket.

## Queue vs pub/sub
| Model | Behavior | Use for |
|-------|----------|---------|
| Queue | Each message is processed by **one** consumer. | Task distribution |
| Pub/sub | Each message goes to **all** subscribers. | Event broadcast |
| Kafka | A log that supports both via consumer groups; keeps messages for replay; ordering is per partition. | Event streaming |

## Delivery guarantees
At-least-once is the most common, so consumers must be idempotent. See
[idempotency and delivery guarantees](../_02_Fundamentals/idempotency-and-delivery-guarantees.md).

## Interview questions
**Q: Why use a message queue?**
Decoupling (the producer doesn't wait for the consumer), buffering traffic spikes, retries,
and scaling consumers independently.

**Q: How do you handle a message that always fails?**
Retry with backoff a fixed number of times, then move it to a DLQ (Dead Letter Queue) for
investigation, and alert.

**Q: How do you keep message ordering in Kafka?**
Use the same partition key (e.g. `order_id`) so related messages go to the same partition,
which is read by one consumer in order.

## Related
- [Distributed transactions](../_02_Fundamentals/distributed-transactions.md): outbox pattern
- [Notification system](../_04_Case_Studies/notification-system.md)
- [Run Kafka and RabbitMQ locally](_02_Docker_Message_Brokers/)
