# Payment System

> **Status:** blueprint. Expand using the case study template in `CLAUDE.md`.

| Area | Blueprint |
|------|-----------|
| Must have | Strong consistency, idempotency keys on every request, a double-entry ledger (every debit has a matching credit), an audit log, reconciliation with the payment provider. |
| Pattern | Saga for multi-step flows; outbox for reliable events. |
| Deep dive | What if the provider times out? Mark the payment PENDING, query the provider's status, and never charge twice. |

## Related
- [Distributed transactions](../_02_Fundamentals/distributed-transactions.md)
- [Idempotency](../_02_Fundamentals/idempotency-and-delivery-guarantees.md)
- [CAP and consistency](../_02_Fundamentals/cap-and-consistency.md): why payments choose CP
