# System Design 101

My notes for learning system design and preparing for system design interviews:
concepts, building blocks, end-to-end case studies, and small experiments that show
ideas in practice.

## Repository structure

| Folder | What's inside |
|--------|---------------|
| [`_01_Interview_Playbook/`](_01_Interview_Playbook/) | How to run the interview: the 45-minute framework, estimation cheat sheet, trade-offs, red flags, final checklist |
| [`_02_Fundamentals/`](_02_Fundamentals/) | Principles and theory: scaling, CAP/PACELC, consistency, replication, sharding, consensus, distributed transactions |
| [`_03_Building_Blocks/`](_03_Building_Blocks/) | Concrete components: load balancers, caches, databases, queues, CDNs, API gateways, object storage, search |
| [`_04_Case_Studies/`](_04_Case_Studies/) | End-to-end designs: URL shortener, chat, news feed, payments, video streaming, and more |
| [`_05_Diagrams/`](_05_Diagrams/) | Diagram sources too large to keep inline (Excalidraw / draw.io) |
| [`_06_Experiments/`](_06_Experiments/) | Small runnable demos of a concept, each with its own README |
| [`resources.md`](resources.md) | Books, papers, blogs, and videos worth revisiting |

## Where to start

Short on time before an interview? Read these three first:

- [Interview framework](_01_Interview_Playbook/interview-framework.md): the 45-minute plan, red flags, final checklist
- [Estimation cheat sheet](_01_Interview_Playbook/estimation-cheat-sheet.md): numbers to memorize
- [Trade-offs](_01_Interview_Playbook/trade-offs.md): what to say out loud

The original one-file version is still in
[`_02_Fundamentals/system-design-interview-guide.txt`](_02_Fundamentals/system-design-interview-guide.txt).

For deeper study, go through the folders in order:

1. **Playbook**: learn the interview framework and the estimation numbers.
2. **Fundamentals**: understand the guarantees and trade-offs behind distributed systems.
3. **Building blocks**: learn how each component works and when to use it.
4. **Case studies**: put it all together, following the playbook's framework.
5. **Experiments**: run a concept to see how it actually behaves.

## How each note is written

- **Concept notes** (`_02_`, `_03_`): TL;DR → why it matters → how it works → trade-offs →
  real-world examples → interview questions → further reading.
- **Case studies** (`_04_`): requirements → capacity estimates → API → data model →
  high-level design → deep dives → scaling → reliability → trade-offs.
- Diagrams use [Mermaid](https://mermaid.js.org/) inside the markdown, so they render
  on GitHub and changes show up in diffs.
- File names are lowercase and hyphenated, e.g. `_04_Case_Studies/url-shortener.md`.

The full conventions and the topic checklist live in [`CLAUDE.md`](CLAUDE.md), which also
tells Claude Code how to help with this repo.

## Progress

See the topic checklist in [`CLAUDE.md`](CLAUDE.md#topic-checklist).
