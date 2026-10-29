# Idempotency and Delivery Guarantees

## TL;DR
Networks and queues retry, so messages and requests arrive more than once. Make handlers
**idempotent**: doing the same operation twice has the same effect as doing it once.

## Delivery guarantees
| Guarantee | Behavior |
|-----------|----------|
| At-most-once | May lose messages, never duplicates. |
| At-least-once | Never loses, may duplicate. **Most common.** |
| Exactly-once | Hard; usually built as at-least-once + an idempotent consumer. |

## Idempotent consumer
```
function handle(message):
    if processedStore.contains(message.id):
        return                          // duplicate, skip
    doWork(message)
    processedStore.add(message.id)      // same transaction as doWork
```

## Idempotent HTTP methods
GET, PUT and DELETE are idempotent; POST is not. For payments and orders, send an
`Idempotency-Key` header so retried POSTs are recognised. See [API design](api-design.md).

## Related
- [Message queues](../_03_Building_Blocks/message-queues.md)
- [Reliability](reliability.md): retries with backoff
- [Payment system](../_04_Case_Studies/payment-system.md)
