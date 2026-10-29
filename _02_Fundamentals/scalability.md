# Scalability

## TL;DR
Scale **up** (bigger machine) until you can't, then scale **out** (more machines). Scaling
out requires stateless services behind a [load balancer](../_03_Building_Blocks/load-balancer.md).

## How it works
| | Vertical (scale up) | Horizontal (scale out) |
|---|---|---|
| What | Bigger machine | More machines |
| Pros | Simple | Near unlimited |
| Cons | Hard hardware limit; a SPOF (Single Point of Failure) | Needs stateless services and coordination |

**Stateless service:** keeps no user data in local memory, so any server can handle any
request. Session data goes to a shared store (e.g. Redis).

## Interview questions
**Q: How do you make a service horizontally scalable?**
Make it stateless, move session/state to a shared store or database, put a load balancer
in front, and auto-scale based on CPU or request count.

**Q: When is vertical scaling the right choice?**
Early stage, small load, or for a database that is hard to shard. It is simpler and
cheaper until you hit the hardware limit.

## Related
- [Sharding](sharding.md): scaling out the data tier
- [Replication](replication.md)
