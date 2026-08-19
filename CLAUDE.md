# marketplace-fee-corpus

**This repository is PUBLIC.** It is the credential for GetValue Consulting's
margin-audit work — the thing a prospect checks before deciding we are worth a
reply.

## Never commit here

- Client names, client data, audit outputs, intake or progress files
- Prospect lists, outreach copy, pricing or commercial terms
- API keys, seller credentials, Seller Central exports tied to an account
- Business strategy, category selection reasoning, revenue modelling

Those belong in the private working repo. If something would be embarrassing or
commercially costly on the front page of Hacker News, it does not go here.

## What does belong

Marketplace fee reference data with explicit provenance, and the calculators
that read it. Nothing else.

## The one rule that gives this repo its value

Every figure carries `_source_tier`, `_sources`, and `_retrieved`. A figure
without provenance is not "mostly fine" — it is the exact failure this corpus
exists to counter. See `corpus/VERIFY.md`.

Do not round, normalise, or tidy a primary figure. Record it as published.
