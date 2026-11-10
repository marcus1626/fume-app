# Product Truth from the product's own page and pictures

Status: BUILT 4 Nov 2026. Before this, nothing in the live app created product facts (only seed data had them), so
the Engine, which writes verified facts into a prompt word for word, had nothing to write for a real customer.

1. Someone on the brand (`app.product_writer`) asks Fume to read a product: the edge function `product-truth`
   calls `ask_product_truth` with their own token, then `product_truth_take` as the service (one reading at a time;
   a reading that never came back is taken again after four minutes; the language model's week is checked).
2. The reader opens the product's website pages (its `website` sources) as text and up to four of its pictures
   (`packshot` sources, files or addresses) as bytes. A picture or page that will not open leaves out only itself.
3. Claude Haiku (with the pictures) proposes facts: shape, colour, material, label and packaging from the
   pictures; claims from the page, copied word for word; and what it could not tell.
4. **Code checks the reading** (`judgeTruth`): a page fact is kept only when its quote is on that page, and a claim is
   kept in the page's own words; a picture fact must name a picture Fume read; nothing the product already has.
   `product_truth_finish` checks again: known areas only, a claim only with a page behind it, no duplicates.
5. Every proposal is **unverified** and `inferred`, with its source and where it came from (`Picture 2`,
   `Page: …`). What a picture must get right (shape, colour, label, packaging) is required, so production waits
   until the brand's owner or approver confirms it (`verify_fact`, or `verify_product` for the product and its facts).
6. The run keeps what it cost, what was left out and why, and what it could not tell (`task_runs`, kind `facts`,
   staff only).

First live run (4 Nov, Nordlys Kaffe (test)): the 33 Cups journal and the AeroPress hand grinder, 9 facts each, about
$0.002 a product. Claims such as "Med over 60 justerbare innstillinger har du full kontroll." are kept exactly as
on kaffa.no.

Not yet: reading on import (today it is asked per product), product files such as spec sheets, and the screen to
ask for a reading (design thread).
