# Databases

## TL;DR
Pick SQL when you need transactions and joins; pick NoSQL for huge write scale, simple
key-based access and flexible schemas. Indexes speed up reads at the cost of writes.

## SQL vs NoSQL
| Aspect | SQL (relational) | NoSQL |
|--------|------------------|-------|
| Schema | Fixed tables | Flexible |
| Guarantees | ACID | Often BASE |
| Scaling | Mostly vertical; sharding is hard | Built for horizontal scale |
| Queries | Joins, complex queries | Simple lookups by key |
| Examples | PostgreSQL, MySQL | Cassandra, DynamoDB, MongoDB, Redis, Cosmos DB |
| Use for | Payments, orders, inventory | Feeds, sessions, logs, IoT |

**ACID:** Atomicity (all or nothing), Consistency (rules always hold), Isolation
(transactions don't see each other's half-finished work), Durability (committed data
survives crashes).

**BASE:** Basically Available, Soft state, Eventually consistent.

## NoSQL types
| Type | Examples | Good for |
|------|----------|----------|
| Key-value | Redis, DynamoDB | Sessions, cache |
| Document | MongoDB, Cosmos DB | Product catalog, user profiles |
| Wide-column | Cassandra, HBase | Time series, huge write volume |
| Graph | Neo4j | Social networks, recommendations |

## Indexing
- An index makes reads fast (like a book index) but makes writes slower and uses extra storage.
- **B-tree index:** good for range queries. The default in most SQL DBs.
- **Hash index:** exact match only.
- **Composite index** on `(a, b)` helps queries on `a` or on `a and b`, not on `b` alone.

## Interview questions
**Q: SQL or NoSQL for this system?**
Ask: do I need transactions or joins? → SQL. Huge write scale, simple access by key,
flexible schema? → NoSQL. "It depends, because…" with reasons is the right answer.

**Q: Your DB is slow. What do you check, in order?**
See [sharding](../_02_Fundamentals/sharding.md#interview-questions).

## Related
- [Replication](../_02_Fundamentals/replication.md)
- [Sharding](../_02_Fundamentals/sharding.md)
- [CAP and consistency](../_02_Fundamentals/cap-and-consistency.md)
