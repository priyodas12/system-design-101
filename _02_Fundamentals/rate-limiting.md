# Rate Limiting

## TL;DR
Cap how many requests a client can make in a period to protect the system from overload
and abuse. **Token bucket** is the most common algorithm.

## Algorithms
| Algorithm | How it works | Notes |
|-----------|--------------|-------|
| Token bucket | Tokens refill at a fixed rate; each request uses one. | Allows short bursts. Most common. |
| Leaky bucket | Requests leave at a fixed rate. | Smooth output. |
| Fixed window | Count requests per minute. | Simple, but bursts at window edges. |
| Sliding window | Smoother version of fixed window. | |

## Token bucket
```
function allow(user):
    bucket = store.get(user)
    refill = (now - bucket.lastRefill) * ratePerSecond
    bucket.tokens = min(capacity, bucket.tokens + refill)
    bucket.lastRefill = now
    if bucket.tokens >= 1:
        bucket.tokens -= 1
        return ALLOW
    return REJECT (HTTP 429 Too Many Requests)
```

## Related
- [Rate limiter case study](../_04_Case_Studies/rate-limiter.md)
- [API design](api-design.md): API gateways usually enforce limits
