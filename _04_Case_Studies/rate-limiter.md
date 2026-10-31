# Rate Limiter

> **Status:** blueprint. Expand using the case study template in `CLAUDE.md`.

| Area | Blueprint |
|------|-----------|
| Where | API gateway or middleware. |
| Algorithm | Token bucket per user/IP (see [rate limiting](../_02_Fundamentals/rate-limiting.md)). |
| Storage | Redis with atomic operations (a Lua script), so many app servers share the same counters. |
| Response | HTTP 429 with a `Retry-After` header. |
| Deep dive | Race conditions; fail-open vs fail-closed if Redis is down. |

## Related
- [API design](../_02_Fundamentals/api-design.md)
- [Cache](../_02_Fundamentals/cache.md)
