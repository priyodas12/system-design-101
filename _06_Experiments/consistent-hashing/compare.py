#!/usr/bin/env python3
"""Compare key placement strategies: how many keys move when a node is added or
removed, and how evenly keys are spread.

Usage: python3 compare.py [num_keys]
"""
import bisect
import hashlib
import statistics
import sys


def h(value: str) -> int:
    """Stable 64-bit hash (Python's built-in hash() is randomized per process)."""
    return int.from_bytes(hashlib.md5(value.encode()).digest()[:8], "big")


# --- Strategies: each takes the node list and returns a key -> node function ---------

def modulo(nodes):
    return lambda key: nodes[h(key) % len(nodes)]


def ring(nodes, vnodes=1):
    points = sorted((h(f"{node}#{i}"), node) for node in nodes for i in range(vnodes))
    hashes = [p for p, _ in points]

    def lookup(key):
        i = bisect.bisect(hashes, h(key)) % len(points)   # next point clockwise, wrapping around
        return points[i][1]
    return lookup


def rendezvous(nodes):
    return lambda key: max(nodes, key=lambda node: h(f"{key}|{node}"))


def jump(nodes):
    def jump_hash(key: int, num_buckets: int) -> int:
        b, j = -1, 0
        while j < num_buckets:
            b = j
            key = (key * 2862933555777941757 + 1) & 0xFFFFFFFFFFFFFFFF
            j = int((b + 1) * ((1 << 31) / ((key >> 33) + 1)))
        return b
    return lambda key: nodes[jump_hash(h(key), len(nodes))]


def bounded_ring(nodes, keys, vnodes=1, c=1.25):
    """Consistent hashing with bounded loads: no node takes more than c x the average."""
    points = sorted((h(f"{node}#{i}"), node) for node in nodes for i in range(vnodes))
    hashes = [p for p, _ in points]
    cap = int(c * len(keys) / len(nodes)) + 1
    load, placement = {n: 0 for n in nodes}, {}
    for key in keys:
        i = bisect.bisect(hashes, h(key))
        while True:
            node = points[i % len(points)][1]
            if load[node] < cap:
                break
            i += 1                                          # node full: keep walking clockwise
        load[node] += 1
        placement[key] = node
    return placement.__getitem__


# --- Measurements ------------------------------------------------------------------------

def moved(before, after, keys):
    return 100 * sum(before(k) != after(k) for k in keys) / len(keys)


def spread(lookup, nodes, keys):
    counts = {n: 0 for n in nodes}
    for k in keys:
        counts[lookup(k)] += 1
    avg = len(keys) / len(nodes)
    return max(counts.values()) / avg, statistics.pstdev(counts.values()) / avg * 100


def main():
    num_keys = int(sys.argv[1]) if len(sys.argv) > 1 else 100_000
    keys = [f"user:{i}" for i in range(num_keys)]
    n4 = [f"node-{i}" for i in range(4)]
    n5 = n4 + ["node-4"]
    n10 = [f"node-{i}" for i in range(10)]

    strategies = [
        ("Modulo  hash(key) % N", modulo),
        ("Ring, 1 point per node", lambda n: ring(n, 1)),
        ("Ring, 100 vnodes per node", lambda n: ring(n, 100)),
        ("Rendezvous (HRW)", rendezvous),
        ("Jump consistent hash", jump),
    ]

    print(f"{num_keys:,} keys\n")
    print(f"{'Strategy':<30}{'add 5th node':>14}{'remove a node':>15}{'max/avg (10 nodes)':>20}{'std dev':>10}")
    for name, build in strategies:
        add = moved(build(n4), build(n5), keys)
        # Remove node-1 from 5 nodes (jump hash can only remove the last bucket).
        removed = n5[:-1] if build is jump else [n for n in n5 if n != "node-1"]
        rem = moved(build(n5), build(removed), keys)
        mx, sd = spread(build(n10), n10, keys)
        print(f"{name:<30}{add:>13.1f}%{rem:>14.1f}%{mx:>19.2f}x{sd:>9.1f}%")

    mx, sd = spread(bounded_ring(n10, keys), n10, keys)
    print(f"{'Ring, 1 point, bounded c=1.25':<30}{'':>14}{'':>15}{mx:>19.2f}x{sd:>9.1f}%")
    print("\nIdeal when adding a 5th node: 20% of keys move (1/5). "
          "Removing 1 of 5 nodes: 20% move (that node's keys).")


if __name__ == "__main__":
    main()
