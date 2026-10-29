# Sharding (Partitioning)

## TL;DR
Split data across machines by a **shard key**. It scales writes and storage, but makes
cross-shard queries, transactions and rebalancing hard.

## Strategies
| Strategy | How | Problem |
|----------|-----|---------|
| Range-based | user_id 1–1M on shard A, … | Hot spots on new ranges |
| Hash-based | `hash(user_id) % N` | Resharding moves lots of data (fix: [consistent hashing](consistent-hashing.md)) |
| Directory-based | Lookup table key → shard | The lookup table is a SPOF |

## Problems sharding brings
- Cross-shard joins and transactions are hard (see [distributed transactions](distributed-transactions.md)).
- Hot shards (one celebrity user gets all the traffic).
- Rebalancing when adding shards.

## Interview questions
**Q: How do you choose a shard key?**
High cardinality (many distinct values), even distribution, and it matches the most common
query so most queries hit one shard. Example: `user_id` for a chat app, not `country`.

**Q: Your DB is slow. What do you check, in order?**
Go from cheapest to most complex:
1. Slow queries and missing indexes
2. Add a cache
3. Read replicas
4. Vertical scaling
5. Shard
6. Split into separate DBs per service

## Related
- [Replication](replication.md)
- [Databases](../_03_Building_Blocks/databases.md)
