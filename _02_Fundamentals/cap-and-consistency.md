# CAP Theorem and Consistency

## TL;DR
During a network partition, a distributed system must choose **consistency** or
**availability**. PACELC adds that even without failures, strong consistency costs latency.

## CAP
During a network **P**artition, choose between:
- **C**onsistency: every read gets the latest write, or an error.
- **A**vailability: every request gets a non-error response.

Partitions always happen in real networks, so the real choice is C or A.

| Choice | Behavior during a partition | Examples |
|--------|-----------------------------|----------|
| CP | Reject requests, stay correct | Bank balance, inventory, ZooKeeper |
| AP | Answer, maybe with stale data | Likes count, social feed, DNS |

## PACELC
If **P**artition → choose **A** or **C**; **E**lse (normal operation) → choose
**L**atency or **C**onsistency.

## Consistency models (strongest to weakest)
| Model | Guarantee |
|-------|-----------|
| Strong / linearizable | Everyone sees the latest write immediately. |
| Read-your-writes | You always see your own updates. |
| Monotonic reads | You never see data go "back in time". |
| Eventual | All copies agree eventually. |

## Interview questions
**Q: Explain CAP with an example.**
Two DB nodes lose connection. A user writes to node 1; another user reads from node 2.
CP: node 2 refuses the read. AP: node 2 returns old data. For a payment system I choose CP;
for a "likes" counter I choose AP.

**Q: How do you give "read-your-writes" with read replicas?**
See [replication](replication.md#interview-questions).

## Related
- [Replication](replication.md)
- [Trade-offs](../_01_Interview_Playbook/trade-offs.md)
