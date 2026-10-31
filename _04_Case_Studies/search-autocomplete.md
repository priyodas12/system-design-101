# Search Autocomplete

> **Status:** blueprint. Expand using the case study template in `CLAUDE.md`.

| Area | Blueprint |
|------|-----------|
| Data | Trie (prefix tree) with the top-k suggestions stored at each node. |
| Updates | Rebuild offline from query logs (batch), not live. |
| Serving | Cache results per prefix; CDN/browser cache for the top prefixes. |

## Related
- [Cache](../_02_Fundamentals/cache.md)
- [Trade-offs](../_01_Interview_Playbook/trade-offs.md): batch vs stream
