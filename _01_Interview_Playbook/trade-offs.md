# Common Trade-offs

## TL;DR
Interviewers want to hear **"I choose X over Y because…, the cost is…"**. Say these out loud.

| Trade-off | Choose first when… |
|-----------|--------------------|
| Consistency vs availability | Money/inventory → consistency. Social/feeds → availability. See [CAP](../_02_Fundamentals/cap-and-consistency.md). |
| Latency vs consistency | Global users + reads → eventual consistency + cache. |
| SQL vs NoSQL | Transactions → SQL. Huge, simple scale → NoSQL. See [databases](../_03_Building_Blocks/databases.md). |
| Sync vs async | User waits for the result → sync. Background work → async. See [message queues](../_03_Building_Blocks/message-queues.md). |
| Push vs pull (feeds) | Normal users → push (fan-out on write). Celebrities → pull (fan-out on read). See [news feed](../_04_Case_Studies/news-feed.md). |
| Normalize vs denormalize | Write-heavy / integrity → normalize. Read-heavy → denormalize. |
| Cache TTL vs fresh data | Short TTL = fresher data but more DB load. |
| Monolith vs microservices | Small team / early stage → monolith. Large teams, independent scaling → microservices. |
| Batch vs stream processing | Daily reports → batch. Fraud alerts → stream. |
