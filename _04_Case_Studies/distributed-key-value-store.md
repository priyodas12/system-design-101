# Distributed Cache / Key-Value Store

> **Status:** blueprint. Expand using the case study template in `CLAUDE.md`.

| Area | Blueprint |
|------|-----------|
| Partitioning | Consistent hashing with virtual nodes. |
| Replication | N copies; quorum reads/writes (W + R > N). |
| Eviction | LRU. |
| Failure | Gossip protocol to detect dead nodes; hinted handoff. |

## Related
- [Consistent hashing](../_02_Fundamentals/consistent-hashing.md)
- [Replication](../_02_Fundamentals/replication.md): quorums
- [Cache](../_02_Fundamentals/cache.md): eviction policies
