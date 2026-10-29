# API Design

## TL;DR
Use resource-based URLs, correct HTTP methods, cursor pagination and versioning. Put an
API gateway in front for auth, rate limiting and routing.

## Guidelines
- Clear resource URLs: `GET /users/{id}/orders`
- Correct HTTP methods: GET (read), POST (create), PUT (replace), PATCH (partial update), DELETE.
- GET, PUT and DELETE are idempotent; POST is not. Use an `Idempotency-Key` header for
  payments and orders (see [idempotency](idempotency-and-delivery-guarantees.md)).
- Pagination: cursor-based ("give me items after id X") beats offset-based for large or
  changing data.
- Versioning: `/v1/...` or a header.
- **API gateway:** a single entry point that handles auth, [rate limiting](rate-limiting.md),
  routing and logging (e.g. AWS API Gateway, Azure APIM = API Management).

## API styles
| Style | What it is | Use for |
|-------|------------|---------|
| REST | Representational State Transfer: HTTP + JSON, resource-based URLs | Public and general-purpose APIs |
| gRPC | Google Remote Procedure Call: binary, HTTP/2, fast, strongly typed | Service-to-service calls |
| WebSocket | Long-lived two-way connection | Chat, live updates |

## Interview questions
**Q: Offset vs cursor pagination?**
Offset (`LIMIT 20 OFFSET 10000`) gets slower as the offset grows and can skip or repeat
items when data changes. A cursor uses the last seen id/time, so it is fast and stable.

## Related
- [Message queues](../_03_Building_Blocks/message-queues.md): sync vs async communication
- [Security](security.md)
