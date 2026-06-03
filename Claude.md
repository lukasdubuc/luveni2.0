# J.A.R.V.I.S — Luveni GM
## CLAUDE.md — Codebase Intelligence Brief

---

### Role
Autonomous General Manager of the `luveni` / `services2day` e-commerce infrastructure.
This file governs all AI-assisted code changes to this repository.

---

### Architecture

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Routing | React Router (Lovable default) |
| Backend | Supabase (PostgreSQL + Edge Functions + Realtime) |
| Payments | Stripe |
| Fulfilment | Printful |
| AI Brain | Gemini 2.5 Flash (free tier via aistudio.google.com) |
| Voice I/O | Web Speech API (browser-native, free) |
| 3D Render | Three.js r128 (CDN) |

---

### Jarvis File Map

```
src/
  components/
    jarvis/
      JarvisHub.tsx       ← Main UI controller, wires all hooks
      NeuralOrb.tsx       ← 80,000-particle WebGL brain orb
  hooks/
    useGemini.ts          ← Gemini 2.5 Flash API + conversation history
    useVoiceInput.ts      ← Continuous VAD + SpeechRecognition (no tap)
    useSpeechOutput.ts    ← Browser TTS with voice priority
  lib/
    jarvis-config.ts      ← System prompt, model config, agent list
  types/
    jarvis.ts             ← TypeScript types
  pages/
    admin/
      jarvis.tsx          ← Route: /admin/jarvis
supabase/
  functions/
    jarvis-brain/
      index.ts            ← Edge Function — server-side Gemini relay
.env                      ← VITE_GEMINI_API_KEY (never commit)
```

---

### Operational Rules for AI Code Changes

1. **Repository Hygiene** — all changes on a feature branch before merge.
   Branch naming: `jarvis/[feature-name]`

2. **Never destructive** — no `rm -rf`, no `DROP TABLE` without explicit approval.

3. **No secrets in frontend** — `VITE_GEMINI_API_KEY` is acceptable in Vite `.env`
   (Vite build-time injection, not runtime exposure). For production, migrate to 
   the Supabase Edge Function relay (`jarvis-brain`) so the key never leaves the server.

4. **Database schema changes** — must include a migration file in 
   `supabase/migrations/` and be reviewed before deploy.

5. **UI/UX Directive** — Yeezy aesthetic (minimalist, dark-first, high-contrast) 
   is the source of truth for all `/shop` and `/admin` surfaces.

6. **Jarvis log** — the Edge Function should log all requests to a 
   `jarvis_logs` Supabase table (future implementation).

7. **Agent dispatch pattern** — when Jarvis references a sub-agent, it prefixes 
   responses with the agent name: "Routing to Inventory Agent:" 

---

### Sub-Agents (Planned Expansion)

| ID | Capability | Status |
|---|---|---|
| `store_ops` | Printful sync, product CRUD, pricing | Active (prompt-only) |
| `inventory` | Stock alerts, reorder logic | Active (prompt-only) |
| `customer_ops` | Order lookup, return processing | Planned |
| `analytics` | Supabase revenue queries | Planned |

---

### Environment Variables

```bash
# .env (Lovable / Vite)
VITE_GEMINI_API_KEY=your_key_from_aistudio.google.com

# Supabase Edge Function Secrets (Dashboard → Edge Functions → Secrets)
GEMINI_API_KEY=your_key_from_aistudio.google.com
```

---

### Getting a Free Gemini API Key

1. Go to https://aistudio.google.com
2. Sign in with Google
3. Click **Get API Key** → **Create API key**
4. Free tier: **1,500 requests/day**, no credit card required
5. Current model: `gemini-2.5-flash` (reasoning-capable, fast, free)

---

*Last updated by Claude — Anthropic*
