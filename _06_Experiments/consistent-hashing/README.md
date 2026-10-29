# Consistent Hashing Comparison

Measures how five key-placement strategies behave when nodes are added or removed, and how
evenly they spread keys. Goes with the [consistent hashing](../../_02_Fundamentals/consistent-hashing.md) note.

## Run it

```bash
python3 compare.py            # 100,000 keys (about 5 seconds)
python3 compare.py 20000      # fewer keys, faster
```

Needs Python 3.8+ and nothing else.

## What it measures

- **Add 5th node:** % of keys whose node changes when going from 4 to 5 nodes. Ideal: 20%.
- **Remove a node:** % of keys that move when one of 5 nodes is removed. Ideal: 20% (just that node's keys).
- **Max/avg:** load on the busiest of 10 nodes, divided by the average. Ideal: 1.00×.
- **Std dev:** spread of load across the 10 nodes, as % of the average. Ideal: close to 0%.

## Results (100,000 keys)

| Strategy | Add 5th node | Remove a node | Max/avg (10 nodes) | Std dev |
|----------|--------------|---------------|--------------------|---------|
| Modulo `hash(key) % N` | 79.9% | 79.9% | 1.02× | 1.0% |
| Ring, 1 point per node | 9.0% | 27.8% | 2.78× | 91.9% |
| Ring, 100 vnodes per node | 18.9% | 18.9% | 1.08× | 5.1% |
| Rendezvous (HRW) | 19.9% | 20.1% | 1.02× | 0.9% |
| Jump consistent hash | 20.1% | 20.1% | 1.02× | 1.2% |
| Ring, 1 point, bounded loads c = 1.25 | | | 1.25× | 32.4% |

## What to observe

- **Modulo** spreads keys evenly but moves ~80% of them on any change: a cache would go almost empty.
- **A ring with one point per node** moves few keys, but unevenly: the new node took only 9%
  (it landed on a short arc), removing a node moved 27.8%, and the busiest node held 2.78× the average.
- **Virtual nodes** fix the balance: 100 points per node brings both movement and load close to ideal.
- **Rendezvous and jump hash** are near-perfect on both measures without any ring.
- **Bounded loads** caps the busiest node at exactly 1.25× the average, even on the uneven ring.

Jump hash can only remove the *last* bucket, so its "remove" column removes `node-4` instead
of `node-1`. Numbers change slightly with the key count and the hash function (MD5 here).
