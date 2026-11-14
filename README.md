# Second Voice Colossus

**Real-Time AI Coercion, Cybercrime & Digital Arrest Detection Engine**

Second Voice Colossus acts as an intelligent server-side call interception proxy positioned between an incoming caller and a protected mobile phone. Every conversation turn is analyzed in real time against a **7-Stage Coercion State Machine** powered by Google Gemini (`gemini-4-hydrogen`) and a multi-category cybercrime trigger lexicon, while persisting all call sessions, caller-to-receiver legs, and reputation records in a centralized **SQLite database** (`data/second_voice.db`).

---

## Architecture Highlights

- **Man-in-the-Middle Call Bridge (`Caller → Second Voice Proxy → Mobile Receiver`)**: Supports Twilio/SIP Voice TwiML relays (`/api/v1/telephony/twiml`), Android `CallScreeningService` webhooks (`/api/v1/telephony/mobile-hook`), carrier conditional call forwarding (`*61*...#`), and live WebSocket streaming (`/api/v1/ws/protect`).
- **Centralized Server SQLite Database (`server/db.ts`)**: Stores `call_sessions`, `call_transcript_events`, `phone_bindings`, and `caller_reputation` on the server (zero raw audio stored; zero dependency on mobile device storage).
- **7-Stage Coercion State Machine & Trajectory Tracking**: Tracks non-resetting escalation from `Phase 0` (Baseline) through `Phase 7` (Financial Coercion) across English, Hindi, and Kannada code-mixing, highlighting every cybercrime trigger keyword (`OTP`, `AnyDesk`, `Digital Arrest`, `CBI/ED/RBI`, `RTGS escrow`, isolation orders) inline.
- **Automated Phase 5+ Circuit Breaker & Telegram SOS**: Triggers receiver-only spoken whisper warnings, call severing + caller blacklisting, Telegram family alerts, and **Cyber Cell 1930 PDF** incident report exports.
- **Deepfake Voice Authenticator**: Client-side Web Audio FFT spectral analysis (spectral flatness, zero-crossing rate, pitch stability, harmonic ratio) paired with Gemini acoustic forensics.

---

## Prerequisites

- **Node.js `>= 22.5.0`** (required for built-in `node:sqlite`)
- **npm `>= 10`**
- **VS Code** (optional, pre-configured in `.vscode/`)

---

## Running Locally in VS Code

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create your `.env` file from the example template:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set your keys:
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   APP_URL="http://localhost:3000"
   TELEGRAM_BOT_TOKEN=""
   TELEGRAM_CHAT_ID=""
   ```
   *(If `GEMINI_API_KEY` is omitted, the engine automatically runs on the built-in Offline Cybercrime Lexicon Fail-Safe.)*

3. **Start the full-stack server (Express + WebSockets + Vite):**
   ```bash
   npm run dev
   ```
   Or press **`F5`** in VS Code using the pre-configured **Second Voice Colossus: Full Stack (Server + Vite)** launch profile.

4. **Open the app:**
   Navigate to `http://localhost:3000` in your browser.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Express + WebSocket proxy + Vite dev middleware on port `3000` |
| `npm run build` | Builds the production React bundle into `dist/` |
| `npm run start` | Runs `server.ts` in production mode (use `NODE_ENV=production npx tsx server.ts` after building) |
| `npm run lint` | Runs TypeScript type-checking (`tsc --noEmit`) |

---

## Key API & Telephony Endpoints

- `WS  /api/v1/ws/protect` — Real-time WebSocket stream for transcript chunks & state sync
- `POST /api/v1/analyze` — Analyze a caller/receiver utterance and persist to SQLite
- `POST /api/v1/bridge/start` — Initiate a tracked call bridge between caller and receiver phone
- `POST /api/v1/bridge/action` — Trigger `WHISPER_ALERT` or `TERMINATED_BY_SHIELD` mid-call
- `POST /api/v1/telephony/twiml` — Twilio/SIP webhook returning `<Stream>` + `<Dial>` TwiML
- `POST /api/v1/telephony/mobile-hook` — Mobile dialer hook returning `ALLOW` / `WHISPER_WARNING` / `TERMINATE_CALL`
- `POST /api/v1/demo/trigger-isolation` — Stage demo Phase 5 Circuit Breaker trigger
- `GET  /api/v1/incidents` — Fetch centralized SQLite call session records
- `POST /api/v1/telephony/audio-chunk` — Receive live 4s call-recording chunks from Android PWA or native Kotlin service, transcribe via `gemini-3.5-transcribe`, and score coercion

---

## Android Mobile & Live Call Recording Integration

1. **Installable Android PWA (`/?mode=mobile`)**: Open **Mobile & Call Bridge** in the web console and scan the QR code from your Android phone to install **SecondVoice**. Runs 0ms spot beeps + hardware vibration (`navigator.vibrate`) and streams rolling 4-second live call audio chunks to the server SQLite database.
2. **Native Android Call Companion (`/android-companion/`)**: Includes `SecondVoiceCallBridge.kt` (`CallScreeningService` + `LiveCallAudioBridgeService` foreground audio streamer) and `AndroidManifest.xml` for direct OS-level dialer call interception and automatic live recording chunk upload.

---

## Pushing to GitHub

```bash
git init
git add .
git commit -m "feat: Second Voice Colossus call proxy, SQLite DB, and coercion engine"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```
