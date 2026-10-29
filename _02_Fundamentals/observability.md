# Observability

## TL;DR
Logs say what happened, metrics show numbers over time, and traces follow one request
across services. Monitor the four golden signals using percentiles, not averages.

## The three pillars
| Pillar | What it tells you |
|--------|-------------------|
| Logs | What happened (structured JSON logs with a correlation/trace id) |
| Metrics | Numbers over time (latency, error rate, throughput) |
| Traces | One request's journey across services (OpenTelemetry) |

## Golden signals
**Latency, Traffic, Errors, Saturation.**

Use percentiles (p50, p95, p99), not averages: averages hide slow requests.

## Related
- [Reliability](reliability.md): SLIs and SLOs are built on these metrics
