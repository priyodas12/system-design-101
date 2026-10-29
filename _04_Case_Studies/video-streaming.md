# Video Streaming (like YouTube)

> **Status:** blueprint. Expand using the case study template in `CLAUDE.md`.

| Area | Blueprint |
|------|-----------|
| Upload | Raw video → object storage → transcoding workers (via a queue) → multiple resolutions. |
| Playback | ABR (Adaptive Bitrate Streaming): the player switches quality based on network speed, using HLS (HTTP Live Streaming) or DASH (Dynamic Adaptive Streaming over HTTP). |
| Delivery | CDN for nearly all traffic. |

```mermaid
flowchart LR
  U[Uploader] --> OS[(Object storage: raw)]
  OS --> Q[[Transcode queue]] --> T[Transcoding workers]
  T --> OS2[(Object storage: renditions)]
  OS2 --> CDN[CDN] --> V[Viewer]
```

## Related
- [Message queues](../_03_Building_Blocks/message-queues.md)
- [Cache](../_03_Building_Blocks/cache.md): CDN
