# File Storage (like Google Drive / Dropbox)

> **Status:** blueprint. Expand using the case study template in `CLAUDE.md`.

| Area | Blueprint |
|------|-----------|
| Upload | Split files into chunks (e.g. 4 MB) and upload only changed chunks. Use pre-signed URLs to upload directly to object storage. |
| Metadata | SQL DB (file name, owner, versions, chunk list). |
| Sync | A notification service tells other devices about changes. |
| Deep dive | Deduplication by chunk hash; conflict handling. |

## Related
- [Databases](../_02_Fundamentals/databases.md)
- [Notification system](notification-system.md)
