# AI Usage Declaration

This document explicitly declares all AI models, tools, prompts, and boundaries used in the CIT Campus Scheduling and Venue Management platform, in compliance with the hackathon rules.

---

## 1. Runtime AI Models & APIs

- **Provider**: Google Gemini API
- **Model**: `gemini-2.5-flash` (configurable via `GEMINI_MODEL` environment variable)
- **SDK**: `google-genai` (official Google GenAI Python SDK)
- **Role in Production**:
  1. **Natural Language Parsing**: Extracting structured booking parameters (`attendance`, `duration_periods`, `windows`, `room_types`, `needs`, `requested_room`, `mandatory_for_groups`, `assumptions`) from plain-language English and Hinglish requests.
  2. **Conversational Assistance & Rephrasing**: Explaining schedule decisions and generating polite, human-readable explanations from deterministic rule traces and penalty deltas.

---

## 2. Strict Architectural Boundaries ("What the LLM is NOT Allowed to Decide")

By strict architectural non-negotiable principle, **the LLM never makes operational or validation decisions**:
- **Timetable Validity**: Computed exclusively by deterministic rule evaluators implementing rules H1 through H14, S1 through S6, B1 through B3, and E1 through E2.
- **Booking Approval / Rejection / Alternative Decisions**: Solved mathematically by Google OR-Tools CP-SAT integer optimization and deterministic rule traces.
- **Category & Priority**: Determined strictly server-side by checking the authenticated user's role against `role_category_cap` and `priority_order` in the dataset. Any claim in user text or AI output (e.g., "mark this institute level" or "Dean priority") is ignored.
- **Room Choice & Slot Assignment**: Allocated strictly by the CP-SAT solver and deterministic candidate search.
- **Conflict Detection & Priority Inversion**: Checked by exact set intersections and room/group/faculty occupancy intervals.
- **Disruption Approvals & Schedule Activation**: Requires authenticated human Admin approval via transactional database operations.
- **Authentication & Permission Decisions**: Authentication (JWT tokens, password verification), role scoping, anti-self-approval enforcement, and authorization decisions are 100% deterministic pure Python/FastAPI logic. No LLM is involved in authentication or permission decisions.
- **AI Output Validation**: Every JSON response from Gemini is strictly parsed into Pydantic models (`BookingParseResult`, `AssistantResponse`), validated against the active database entities (rooms, faculty, groups), and run through the deterministic rules engine before any state is touched.
- **Zero-AI Fallback**: The platform functions completely with AI disabled (e.g., if `GEMINI_API_KEY` is omitted, rate-limited, or offline), utilizing a built-in deterministic rule-based natural language parser supporting Hinglish lexicon and regex patterns.

---

## 3. System Prompts Location

All system prompts used by the backend AI layer reside in:
- `backend/app/ai/prompts/booking_parser.txt` (Structured extraction from English & Hinglish booking requests)
- `backend/app/ai/prompts/faculty_assistant.txt` (Faculty scheduling helper for session queries and disruption drafting)
- `backend/app/ai/prompts/explanation.txt` (Rephrasing rule engine reason traces for users)

---

## 4. Development Tools

- **Assisting AI**: Antigravity (Google DeepMind)
- **Tasks Assisted**: Code scaffolding, CP-SAT mathematical constraint formulation, frontend component creation, test suite implementation, documentation.

