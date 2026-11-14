# Second Voice Colossus — Android Mobile Call Integration

You have **two ways** to connect your Android phone to Second Voice Colossus so that live phone calls are monitored on the spot (with instant audible beeps & hardware vibration) and stored exclusively in the centralized server SQLite database:

---

## Option A: Zero-Build Instant Android Mobile App (Installable PWA)

1. On the desktop console, open **Mobile & Call Bridge** and scan the QR code with your Android phone (or open `https://<your-app-url>/?mode=mobile`).
2. Tap **Install Mobile App** to add **SecondVoice** to your Android home screen.
3. During a call (on **Speakerphone** or **Bluetooth HFP**):
   - Tap **Start Live Call & Recording Tracker**.
   - **0ms Local Spot Beep + Android Vibration**: Triggers immediately on cybercrime phrases (`OTP`, `AnyDesk`, `Digital Arrest`, `CBI/ED`, `do not tell anyone`, `RTGS transfer`).
   - **Rolling Live Call Recording Stream**: Streams 4-second audio chunks to `POST /api/v1/telephony/audio-chunk`, where the server transcribes via Gemini (`gemini-3.5-transcribe`), evaluates the 7-Stage Coercion State Machine, saves the turn in `data/second_voice.db`, and pushes live updates to the desktop console over WebSockets.

---

## Option B: Native Android `CallScreeningService` + Foreground Audio Bridge (Kotlin)

For direct OS-level dialer call interception and automatic background call recording chunk capture on Android 10+:

1. Create or open an Android Studio Kotlin project (`minSdk 29`, `targetSdk 34`).
2. Copy `SecondVoiceCallBridge.kt` into `app/src/main/java/com/secondvoice/colossus/android/`.
3. Merge the permissions and `<service>` blocks from `AndroidManifest.xml` into your app manifest.
4. Set `SecondVoiceConfig.serverBaseUrl` to your deployed HTTPS server URL (or `http://<LAN-IP>:3000` on local Wi-Fi).
5. Request `RoleManager.ROLE_CALL_SCREENING` and runtime `RECORD_AUDIO` / `READ_PHONE_STATE` permissions at launch.
6. Every incoming call hits `POST /api/v1/telephony/mobile-hook` (auto-blocking blacklisted numbers before ringing) and starts `LiveCallAudioBridgeService`, which uploads 4-second audio chunks to `POST /api/v1/telephony/audio-chunk`, deletes the local temp buffer immediately (zero audio stored on phone), and fires `ToneGenerator` + `Vibrator` alerts if Phase 2+ coercion is detected.
