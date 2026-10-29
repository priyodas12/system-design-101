# Replication

## TL;DR
Keep copies of data on several nodes for availability and read scale. The cost is
replication lag or slower writes, depending on the mode.

## Topologies
| Topology | How it works | Watch out for |
|----------|--------------|---------------|
| Leader-follower | Writes go to the leader; reads spread to followers. | Replication lag: followers may return old data. |
| Multi-leader | Several nodes accept writes. | Needs conflict resolution. |
| Leaderless | Any node accepts writes (Cassandra, DynamoDB). | Uses quorums for consistency. |

**Quorum:** with N copies, a write must be confirmed by W nodes and a read asks R nodes.
**W + R > N** means every read overlaps the latest write, which gives strong reads.

## Sync vs async
| Mode | Pros | Cons |
|------|------|------|
| Synchronous | Safe | Slower writes |
| Asynchronous | Fast | May lose recent writes if the leader dies |

## Interview questions
**Q: How do you give "read-your-writes" with read replicas?**
Route a user's reads to the leader for a few seconds after they write, or track the write
version and only read from replicas that have caught up.

## Related
- [CAP and consistency](cap-and-consistency.md)
- [Sharding](sharding.md)
- [Databases](../_03_Building_Blocks/databases.md)
