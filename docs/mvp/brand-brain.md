# Brand Brain: the brand's knowledge graph

Status: PROPOSED by Claude, 3 Nov 2026, after Marcus (17:05Z): "Brand DNA er jo mye mer enn bare det som står i Brand
DNA fanene, det skal være en hel Brand Brain Knowledge graph". Marcus decides. "Brand Brain" is the internal name;
customers keep seeing "Brand DNA" (DECIDED 2 Oct).

## 1. What it is

One graph per brand that holds everything Fume knows and learns about it. Each piece carries where it came from, who
said it, when, how sure Fume is, and its state (proposed, approved, changed, removed). The pieces are connected, so Fume
can answer "what do we know about this product, for this audience, on this channel, and what did the customer say no
to last time?".

The Brand DNA tabs (identity, products, taste) stay as the brand's curated face. They become views into the graph,
not the whole of it.

## 2. What is in it

| Layer | Nodes | Comes from |
| --- | --- | --- |
| Identity | colours, typefaces, logos, voice lines and traits, imagery groups | website reading, uploads, the customer |
| Products | products, facts (Product Truth), specs, pictures, collections, categories | shop import, the customer, files |
| Rules | do and don't per area, claims that are allowed or banned, legal limits per market | brand guide, the customer, the expert, learned |
| Taste | liked and disliked references with the reason, taste pairs, light and camera, moodboards | taste swipes, moodboards, the customer |
| Market | audiences, markets and languages, channels and placements, seasons and dates, competitors | the customer, the brief, the website |
| Creative Memory | campaigns, briefs, plans, creatives, checks, approvals, change requests and why | every campaign |
| Sources | web pages, files, chat messages, meetings | wherever a piece was read |

Typed connections between nodes, for example: *shows* (a picture shows a product), *uses* (a creative uses a colour),
*about* (a fact is about a product), *for* (a rule is for a market, a line is for an audience), *from* (any piece comes
from a source), *rejected because* (a change request and its reason), *replaces* and *contradicts*.

## 3. How it learns

- Reading (website, files, shop) writes **proposed** nodes. The customer keeps, changes or removes them.
- What the customer says is **approved** as theirs. What the expert or the agency adds is proposed until the customer
  keeps it, except what the existing rules already let them decide.
- Every approval, change request with its reason, expert check finding and taste swipe writes to Creative Memory.
- A pattern that repeats (three change requests that all say "too dark") becomes a **proposed rule** for the customer
  to confirm. Fume never promotes a proposal to a rule on its own.
- A contradiction (the website says 100 ml, the customer says 150 ml) is a node of its own until someone settles it.

## 4. Who uses it

- Fume (the chat), when it answers and when it writes a brief.
- The plan writer, which reads the brand, products, rules, taste and memory before it proposes a plan.
- The Engine, which gets a frozen snapshot of the part of the graph a job needs (the ContextSnapshot in
  domain-model.md), so a creative can always say what it was made from.
- The expert in Check, who sees the rules and facts that apply to the creative in front of them.

## 5. How it is built

- In the Supabase Postgres we already run. No separate graph database: one source of truth, the same access rules
  (row-level security per brand), and no new vendor.
- Two tables, `brain_nodes` and `brain_edges`, each with kind, provenance, confidence and the source it came from. A
  node either points at an existing row (a product, a fact, a creative) or holds knowledge that has no table of its
  own (an audience, a reason, something said in the chat).
- Triggers keep the graph in step with the existing tables, so nothing is written twice by hand.
- Search by meaning with pgvector and Supabase's own embedding model (gte-small, run inside the edge functions), so it
  costs nothing extra and does not depend on Anthropic or OpenAI.
- One database function gives "the context for this job" (brand, campaign, products) as a small bundle the chat, the
  plan writer and the Engine all read.

## 6. Order

1. Tables, sync from what exists today (identity, products, facts, rules, taste, campaigns, approvals, change
   requests), and the context bundle; the plan writer and the chat read it.
2. Learning: Creative Memory from approvals, change requests, checks and swipes; proposed rules from patterns.
3. Search by meaning.
4. The Brand Brain view in the app, once the design thread has drawn it and Marcus has approved it.

## 7. Decided around it

- Both the agency and the customer can add and change products (Marcus, 3 Nov 17:05Z); confirming stays with the
  customer's owner or approver.
