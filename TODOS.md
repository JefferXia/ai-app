# TODOS

## P1 - High Priority

### Long-Term Memory for Aura
**Why:** The one thing human streamers cannot do — remember every conversation. Creates switching costs and deepens emotional bond.
**What:** Persist conversation summaries, user preferences, key facts (boss's name, worries, dreams) across sessions.
**Effort:** L (human: 2 weeks / CC: ~2 hours)
**Status:** Deferred from CEO Review 2026-03-23
**Context:** Voice-first is the priority. Memory can follow as a differentiator.

---

## P2 - Medium Priority

### Comprehensive Test Coverage for Aura
**Why:** State machine transitions, intent analysis, and API routes are untested. Risk of regressions.
**What:** Unit tests for `aura-state-machine.ts`, integration tests for API routes, component tests for `AuraInterface`.
**Effort:** M (human: 3 days / CC: ~1 hour)
**Status:** Deferred from CEO Review 2026-03-23
**Context:** Manual testing acceptable for now. Add tests before scaling.

### Rate Limiting for Aura API
**Why:** Anyone can spam `/api/aura/chat-stream` and burn through MiniMax quota.
**What:** Per-IP or per-session rate limiting. Consider user authentication for higher limits.
**Effort:** S (human: 1 day / CC: ~15 min)
**Status:** Deferred from CEO Review 2026-03-23
**Context:** Add after launch if abuse occurs.

---

## P3 - Low Priority

### Analytics & Observability for Aura
**Why:** No visibility into feature usage, response times, or errors.
**What:**
- Time-to-first-byte for LLM
- TTS generation time
- User session duration
- Character popularity
- Conversation depth before sleep mode
**Effort:** M (human: 2 days / CC: ~30 min)
**Status:** Deferred from CEO Review 2026-03-23
**Context:** Add after validating product-market fit.

---

## Completed

_(None yet)_