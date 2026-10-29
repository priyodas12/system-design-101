# Estimation Cheat Sheet

## TL;DR
Use round numbers (1 day ≈ 10^5 s) and know the **order of magnitude** of latencies and
availability. The goal is a defensible estimate, not a precise one.

## Time
| Unit | Seconds |
|------|---------|
| 1 day | 86,400 ≈ **10^5** (use this for quick math) |
| 1 month | ≈ 2.5 × 10^6 |
| 1 year | ≈ 3 × 10^7 |

## Quick QPS (Queries Per Second) conversions
| Requests/day | Average QPS |
|--------------|-------------|
| 1 million | ~12 |
| 10 million | ~120 |
| 100 million | ~1,200 |
| 1 billion | ~12,000 |

Peak QPS ≈ **2× to 3×** the average QPS.

## Data sizes
| Unit | Bytes | Rough example |
|------|-------|---------------|
| 1 KB | 10^3 | a short text record |
| 1 MB | 10^6 | a photo |
| 1 GB | 10^9 | |
| 1 TB | 10^12 | |
| 1 PB | 10^15 | |

## Latency numbers
Approximate: know the order, not exact values.

| Operation | Latency |
|-----------|---------|
| L1 CPU cache read | 1 ns |
| Main memory (RAM) read | 100 ns |
| SSD random read | 100 µs |
| Round trip inside same data center | 0.5 ms |
| HDD seek | 10 ms |
| Round trip across continents | 150 ms |

**Key takeaway:** memory is ~1000× faster than SSD, and a round trip across the world is
very slow. This is why [caching](../_03_Building_Blocks/cache.md) and CDNs matter.

## Availability ("the nines")
| Availability | Downtime/year |
|--------------|---------------|
| 99% | ~3.65 days |
| 99.9% | ~8.76 hours |
| 99.99% | ~52.6 minutes |
| 99.999% | ~5.26 minutes |

- **In series** (both must work): multiply. 99.9% × 99.9% = **99.8%**
- **In parallel** (either can work): 1 − (failure × failure). 1 − (0.001 × 0.001) = **99.9999%**

See [reliability](../_02_Fundamentals/reliability.md) for how to design for these targets.

## Sample estimate: Twitter-like app
- 200 million DAU; each reads 100 posts/day and writes 2 posts/day.
- **Reads:** 200M × 100 / 10^5 = **200,000 read QPS**
- **Writes:** 200M × 2 / 10^5 = **4,000 write QPS**
- Read:write ratio = 50:1 → read-heavy → cache aggressively.
- **Storage:** 400M posts/day × 300 bytes = 120 GB/day ≈ **44 TB/year** (text only).
