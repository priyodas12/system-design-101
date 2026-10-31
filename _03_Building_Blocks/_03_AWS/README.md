# AWS (local)

Standalone, Docker-run stand-ins for AWS services, so the ideas in
[message queues](../../_02_Fundamentals/message-queues.md) can be tried hands-on without an AWS account.

| Service | What it is | Ports | Fill in `.env` |
|---|---|---|---|
| [SQS + SNS](sqs-sns/) | Queue (standard + FIFO, DLQ, long polling) and pub/sub topics (fan-out to queues, filter policies) behind one AWS-console-style UI | 9324 | Nothing (no login) |

Same rules as the other labs: one folder per stack, named volume, container named
`sd101-<service>`.
