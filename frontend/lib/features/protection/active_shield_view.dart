import 'package:flutter/material.dart';
import '../../core/audio_streamer.dart';
import 'floating_overlay.dart';

class ActiveShieldView extends StatefulWidget {
  const ActiveShieldView({super.key});

  @override
  State<ActiveShieldView> createState() => _ActiveShieldViewState();
}

class _ActiveShieldViewState extends State<ActiveShieldView> {
  final AudioTranscriptStreamer _streamer = AudioTranscriptStreamer();
  final TextEditingController _mockInputController = TextEditingController();

  int _currentPhase = 0;
  String _riskLevel = 'LOW';
  String _fingerprint = 'Monitoring audio stream for coercion patterns...';
  bool _isIsolated = false;

  @override
  void initState() {
    super.initState();
    _streamer.connect();
    _streamer.analysisStream.listen((data) {
      if (mounted) {
        final analysis = data['analysis'] as Map<String, dynamic>? ?? {};
        final systemState = data['system_state'] as Map<String, dynamic>? ?? {};

        setState(() {
          _currentPhase = analysis['detected_phase'] ?? 0;
          _riskLevel = analysis['risk_level'] ?? 'LOW';
          _fingerprint = analysis['coercion_fingerprint'] ?? 'Normal activity';
          _isIsolated = systemState['isolation_breached'] ?? false;
        });
      }
    });
  }

  @override
  void dispose() {
    _streamer.dispose();
    _mockInputController.dispose();
    super.dispose();
  }

  void _sendTestChunk(String text) {
    if (text.trim().isNotEmpty) {
      _streamer.sendTranscriptChunk(text);
      _mockInputController.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Second Voice Active Shield'),
        actions: [
          IconButton(
            icon: Icon(
              _streamer.isConnected ? Icons.shield : Icons.shield_outlined,
              color: _streamer.isConnected ? Colors.greenAccent : Colors.redAccent,
            ),
            tooltip: _streamer.isConnected ? 'Engine Connected' : 'Engine Disconnected',
            onPressed: () {},
          )
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: FloatingAlertOverlay(
                  currentPhase: _currentPhase,
                  riskLevel: _riskLevel,
                  fingerprint: _fingerprint,
                  onBreakCall: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('CIRCUIT BREAKER ENGAGED: Call terminated & Telegram SOS dispatched!'),
                        backgroundColor: Colors.redAccent,
                      ),
                    );
                  },
                ),
              ),
            ),
            const Divider(color: Colors.white24),
            const Text(
              'Simulate Incoming Scam Transcript (Live Test Bench):',
              style: TextStyle(color: Colors.white70, fontSize: 12),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _mockInputController,
                    decoration: InputDecoration(
                      hintText: 'e.g., Go to a separate room and do not cut call...',
                      hintStyle: const TextStyle(color: Colors.white38),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () => _sendTestChunk(_mockInputController.text),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent),
                  child: const Text('Inject'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}