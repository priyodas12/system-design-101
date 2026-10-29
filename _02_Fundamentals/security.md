# Security

## TL;DR
Authenticate who the caller is, authorize what they can do, encrypt in transit and at
rest, keep secrets in a vault, and protect APIs at the edge.

| Area | Key points |
|------|------------|
| Authentication (AuthN) | Who are you? OAuth 2.0, OIDC (OpenID Connect). |
| Authorization (AuthZ) | What can you do? RBAC (Role-Based Access Control). |
| JWT (JSON Web Token) | Signed token carrying user claims; stateless auth. |
| Encryption | TLS (Transport Layer Security) in transit; AES encryption at rest. |
| Secrets | Store in a vault (AWS Secrets Manager, Azure Key Vault), never in code. |
| Protecting APIs | [Rate limiting](rate-limiting.md), input validation, WAF (Web Application Firewall). |

## Related
- [API design](api-design.md)
