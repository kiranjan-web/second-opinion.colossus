package com.secondvoice.colossus.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.MediaRecorder
import android.media.ToneGenerator
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.telecom.Call
import android.telecom.CallScreeningService
import android.telephony.TelephonyManager
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * Second Voice Colossus — Native Android Call Screening, Ongoing Call State Listener & Keyword Scanner
 *
 * Scans the ongoing conversation between caller and receiver on Android devices, detects every
 * cybercrime/scam keyword (digital arrest, OTP, coercion, AnyDesk, CBI/ED, RTGS, isolation),
 * fires instant local beeps + vibration, and stores all records in the centralized Server SQLite DB.
 */
object SecondVoiceConfig {
    // Replace with your live server origin (or LAN IP when testing via USB/Wi-Fi)
    @Volatile
    var serverBaseUrl: String = "http://10.0.2.2:3000"

    @Volatile
    var protectedMobileNumber: String = "+91 98450 71202"
}

/**
 * Fast on-device scam keyword matcher mirrored with the Second Voice server lexicon.
 */
object OnDeviceKeywordScanner {
    private val RULES: List<Pair<Int, Regex>> = listOf(
        7 to Regex("\\b(rtgs|imps|neft|upi|wire transfer|bank transfer|transfer money|send money|escrow|secret account|verification account|clearance fee|verification fee|liquidate|upi collect|gift card|usdt|crypto wallet|(sent|transferred).{0,20}(by mistake|accidentally))\\b", RegexOption.IGNORE_CASE),
        6 to Regex("\\b(otp|one time password|cvv|atm pin|upi pin|mpin|(4|5|6|four|five|six)[ -]?digit (code|number|pin)|(verification|security|confirmation|cancellation|refund|reference|secret) (code|number|pin)|code aaya|number aaya|enter.{0,15}pin to (receive|get|claim|accept)|anydesk|teamviewer|quicksupport|rustdesk|screen ?share|download apk|whatsapp video|skype|zoom video|video call)\\b", RegexOption.IGNORE_CASE),
        5 to Regex("\\b(don'?t tell|do not tell|tell no one|kisi ko mat batana|kisi ko mat bolna|yargu helbedi|nobody( at home)? needs to know|just between us|separate room|lock( the| your)? door|do not cut the call|don'?t hang up|national security|confidential)\\b", RegexOption.IGNORE_CASE),
        4 to Regex("\\b(digital arrest|house arrest|virtual custody|arrest warrant|non-bailable warrant|warrant|coercion|coerce|blackmail|extort(ion)?|sextortion|freeze|bank freeze|account freeze|cbi raid|(hang up|disconnect).{0,25}(guilt|guilty|confession|arrest|action)|last warning|final warning|within \\d+ minutes|don'?t waste time)\\b", RegexOption.IGNORE_CASE),
        3 to Regex("\\b(money laundering|hawala|narcotics|drugs|aadhaar|pan card|scam|fraud)\\b", RegexOption.IGNORE_CASE),
        2 to Regex("\\b(cyber ?crime|cyber ?cell|cbi|enforcement directorate|customs|rbi|mumbai police|delhi police|ips officer|dcp|inspector|supreme court|fir)\\b", RegexOption.IGNORE_CASE),
        1 to Regex("\\b(fedex|dhl|courier|parcel|trai|sim block|kyc|(electricity|power|gas|bank|sim).{0,20}(cut|disconnect|block).{0,15}(today|tonight)?)\\b", RegexOption.IGNORE_CASE),
    )

    fun scan(text: String): Pair<Int, List<String>> {
        var highestPhase = 0
        val matched = linkedSetOf<String>()
        for ((phase, regex) in RULES) {
            regex.findAll(text).forEach { result ->
                val hit = result.value.trim()
                if (hit.isNotEmpty()) {
                    matched.add(hit)
                    if (phase > highestPhase) highestPhase = phase
                }
            }
        }
        return highestPhase to matched.toList()
    }
}

class SecondVoiceCallScreeningService : CallScreeningService() {
    private val ioExecutor = Executors.newSingleThreadExecutor()

    override fun onScreenCall(callDetails: Call.Details) {
        val callerNumber = callDetails.handle?.schemeSpecificPart ?: "Unknown"
        ioExecutor.execute {
            val directive = postMobileHook(
                callerNumber = callerNumber,
                receiverPhone = SecondVoiceConfig.protectedMobileNumber,
                transcript = ""
            )

            val responseBuilder = CallResponse.Builder()
            if (directive == "TERMINATE_CALL") {
                responseBuilder
                    .setDisallowCall(true)
                    .setRejectCall(true)
                    .setSkipCallLog(false)
                    .setSkipNotification(false)
                triggerLocalSpotBeep(applicationContext, critical = true)
            } else {
                responseBuilder.setDisallowCall(false)
                startLiveCallAudioBridge(applicationContext, callerNumber)
            }

            respondToCall(callDetails, responseBuilder.build())
        }
    }

    private fun postMobileHook(
        callerNumber: String,
        receiverPhone: String,
        transcript: String
    ): String {
        return try {
            val url = URL("${SecondVoiceConfig.serverBaseUrl}/api/v1/telephony/mobile-hook")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                connectTimeout = 3500
                readTimeout = 3500
                doOutput = true
            }
            val payload = JSONObject().apply {
                put("caller_number", callerNumber)
                put("receiver_phone", receiverPhone)
                put("speaker_leg", "CONVERSATION")
                put("transcript", transcript)
            }
            conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val body = conn.inputStream.bufferedReader().readText()
            JSONObject(body).optString("directive", "ALLOW")
        } catch (_: Exception) {
            "ALLOW"
        }
    }
}

/**
 * Automatically starts/stops live call conversation scanning whenever ANY incoming or outgoing
 * phone call goes OFFHOOK (active) or IDLE (hung up) on the Android handset.
 */
class CallStateBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        @Suppress("DEPRECATION")
        val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: "Ongoing Call"

        when (state) {
            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                startLiveCallAudioBridge(context, incomingNumber)
            }
            TelephonyManager.EXTRA_STATE_IDLE -> {
                val stopIntent = Intent(context, LiveCallAudioBridgeService::class.java).apply {
                    action = LiveCallAudioBridgeService.ACTION_STOP
                }
                context.startService(stopIntent)
            }
        }
    }
}

private fun startLiveCallAudioBridge(context: Context, callerNumber: String) {
    val intent = Intent(context, LiveCallAudioBridgeService::class.java).apply {
        action = LiveCallAudioBridgeService.ACTION_START
        putExtra(LiveCallAudioBridgeService.EXTRA_CALLER_NUMBER, callerNumber)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
    } else {
        context.startService(intent)
    }
}

/**
 * Foreground service that captures rolling 4-second audio chunks during an ongoing phone call
 * (covering both caller and receiver dialogue) and streams them to POST /api/v1/telephony/audio-chunk
 * for server-side Gemini transcription + scam keyword scanning. Deletes local buffers immediately.
 */
class LiveCallAudioBridgeService : Service() {
    companion object {
        const val ACTION_START = "com.secondvoice.colossus.START_AUDIO_BRIDGE"
        const val ACTION_STOP = "com.secondvoice.colossus.STOP_AUDIO_BRIDGE"
        const val EXTRA_CALLER_NUMBER = "caller_number"
        private const val CHANNEL_ID = "second_voice_call_bridge"
        private const val NOTIFICATION_ID = 1930
    }

    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private var chunkTask: ScheduledFuture<*>? = null
    private var recorder: MediaRecorder? = null
    private var currentChunkFile: File? = null
    private var activeCallerNumber: String = "Unknown"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopBridge()
            stopSelf()
            return START_NOT_STICKY
        }

        activeCallerNumber = intent?.getStringExtra(EXTRA_CALLER_NUMBER) ?: "Ongoing Call"
        ensureNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Scanning ongoing call ($activeCallerNumber) for scam keywords"))
        startRollingCapture()
        return START_STICKY
    }

    private fun startRollingCapture() {
        chunkTask?.cancel(true)
        beginNextChunk()
        chunkTask = scheduler.scheduleAtFixedRate(
            { rotateAndUploadChunk() },
            4L,
            4L,
            TimeUnit.SECONDS
        )
    }

    @Suppress("DEPRECATION")
    private fun beginNextChunk() {
        val file = File(cacheDir, "sv_chunk_${System.currentTimeMillis()}.m4a")
        currentChunkFile = file

        val rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(this)
        } else {
            MediaRecorder()
        }

        try {
            rec.setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
        } catch (_: Exception) {
            rec.setAudioSource(MediaRecorder.AudioSource.MIC)
        }

        rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        rec.setAudioSamplingRate(16000)
        rec.setAudioEncodingBitRate(32000)
        rec.setOutputFile(file.absolutePath)
        rec.prepare()
        rec.start()
        recorder = rec
    }

    private fun rotateAndUploadChunk() {
        val finishedFile = currentChunkFile
        try {
            recorder?.apply {
                stop()
                reset()
                release()
            }
        } catch (_: Exception) {
        } finally {
            recorder = null
        }

        try {
            beginNextChunk()
        } catch (_: Exception) {
        }

        if (finishedFile != null && finishedFile.exists()) {
            try {
                val bytes = finishedFile.readBytes()
                if (bytes.size > 1024) {
                    val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                    uploadChunkToServer(b64, "audio/mp4")
                }
            } finally {
                // Zero persistent raw audio stored on Android handset
                finishedFile.delete()
            }
        }
    }

    private fun uploadChunkToServer(audioBase64: String, mimeType: String) {
        try {
            val url = URL("${SecondVoiceConfig.serverBaseUrl}/api/v1/telephony/audio-chunk")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                connectTimeout = 5000
                readTimeout = 8000
                doOutput = true
            }
            val body = JSONObject().apply {
                put("audioBase64", audioBase64)
                put("mimeType", mimeType)
                put("speaker_leg", "CONVERSATION")
                put("caller_number", activeCallerNumber)
                put("receiver_phone", SecondVoiceConfig.protectedMobileNumber)
            }
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }

            val responseText = conn.inputStream.bufferedReader().readText()
            val json = JSONObject(responseText)
            val transcript = json.optJSONObject("entry")?.optString("transcript", "") ?: ""
            val (localPhase, localKeywords) = OnDeviceKeywordScanner.scan(transcript)
            val serverPhase = json.optJSONObject("system_state")?.optInt("current_highest_phase", 0) ?: 0
            val phase = maxOf(serverPhase, localPhase)
            val directive = json.optString("directive", "ALLOW")

            if (phase >= 1) {
                val mgr = getSystemService(NotificationManager::class.java)
                val kwText = if (localKeywords.isNotEmpty()) localKeywords.joinToString(", ") else "Coercion detected"
                mgr?.notify(
                    NOTIFICATION_ID,
                    buildNotification("SCAM KEYWORD ALERT (P$phase): $kwText")
                )
            }

            if (phase >= 5 || directive == "TERMINATE_CALL") {
                triggerLocalSpotBeep(applicationContext, critical = true)
            } else if (phase >= 1 || directive == "WHISPER_WARNING") {
                triggerLocalSpotBeep(applicationContext, critical = false)
            }
        } catch (_: Exception) {
        }
    }

    private fun stopBridge() {
        chunkTask?.cancel(true)
        try {
            recorder?.stop()
            recorder?.release()
        } catch (_: Exception) {
        }
        recorder = null
        currentChunkFile?.delete()
    }

    override fun onDestroy() {
        stopBridge()
        scheduler.shutdownNow()
        super.onDestroy()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Second Voice Call Screening Bridge",
                NotificationManager.IMPORTANCE_HIGH
            )
            mgr?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(statusText: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Second Voice Colossus Active")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
    }
}

internal fun triggerLocalSpotBeep(context: Context, critical: Boolean) {
    try {
        val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
        tone.startTone(
            if (critical) ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD else ToneGenerator.TONE_PROP_BEEP2,
            if (critical) 600 else 320
        )
    } catch (_: Exception) {
    }

    try {
        val pattern = if (critical) longArrayOf(0, 220, 80, 220, 80, 360) else longArrayOf(0, 160, 70, 160)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            val vib = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vib?.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                vib?.vibrate(pattern, -1)
            }
        }
    } catch (_: Exception) {
    }
}
