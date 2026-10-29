# Interview Framework

## TL;DR
Interviewers judge your **process** more than the final diagram. Clarify first, estimate,
define the API and data model, draw the high-level design, then go deep on the hardest parts.

## Time split (45-minute round)

| Step | Time | What to do |
|------|------|------------|
| 1. Clarify requirements | 5 min | Ask questions. Do not design yet. |
| 2. Estimate scale | 5 min | QPS, storage, bandwidth. See [estimation cheat sheet](estimation-cheat-sheet.md). |
| 3. Define API + data model | 5 min | Main endpoints and tables. |
| 4. High-level design | 10 min | Boxes and arrows, end to end. |
| 5. Deep dive | 15 min | 2–3 hardest parts in detail. |
| 6. Bottlenecks + wrap up | 5 min | Failures, scaling, [trade-offs](trade-offs.md). |

## Step 1: Questions to ask
- Who are the users? How many? (DAU = Daily Active Users)
- What are the top 3 features? What is out of scope?
- Read-heavy or write-heavy?
- Is strong consistency needed, or is slightly stale data OK?
- Latency target? (e.g. p99 < 200 ms; p99 = 99% of requests are faster than this)
- Availability target? (e.g. 99.9%)
- Global or single region?

## Step 2: Functional vs non-functional requirements
- **Functional**: what the system does ("user can upload a photo").
- **Non-functional**: how well it does it (scale, speed, uptime, consistency).

Always write both lists on the whiteboard. Interviewers look for this.

## Red flags to avoid
- Jumping into the design without asking requirements.
- Naming tools ("use Kafka") without saying **why**.
- No numbers: never estimating scale.
- Single database / single server with no plan for failure.
- Ignoring trade-offs or saying "this is the best solution".
- Over-engineering a small system (microservices for 1,000 users).
- Going silent. Think out loud; the interviewer wants your reasoning.
- Ignoring the interviewer's hints. If they ask "what about X?", X matters.

## Final checklist before you say "done"
- [ ] Requirements (functional + non-functional) written down
- [ ] Scale estimated (QPS, storage, read:write ratio)
- [ ] API endpoints defined
- [ ] Data model + database choice justified
- [ ] High-level diagram covers the full request path
- [ ] Caching strategy explained
- [ ] Scaling plan (stateless services, replicas, sharding)
- [ ] No single point of failure
- [ ] Failure handling (retries, timeouts, circuit breaker, DLQ)
- [ ] Consistency choice explained (CAP)
- [ ] Monitoring and alerting mentioned
- [ ] Security (auth, rate limiting, encryption) mentioned
- [ ] Trade-offs and future improvements stated
