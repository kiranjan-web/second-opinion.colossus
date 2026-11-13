import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class AudioTranscriptStreamer {
  WebSocketChannel? _channel;
  final StreamController> _analysisController =
      StreamController>.broadcast();

  Stream> get analysisStream => _analysisController.stream;
  bool _isConnected = false;

  bool get isConnected => _isConnected;

  void connect({String url = 'ws://127.0.0.1:8000/api/v1/ws/protect'}) {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      _isConnected = true;

      _channel!.stream.listen(
        (message) {
          final decoded = jsonDecode(message as String) as Map<String, dynamic>;
          _analysisController.add(decoded);
        },
        onError: (error) {
          debugPrint('WebSocket stream error: $error');
          _isConnected = false;
        },
        onDone: () {
          debugPrint('WebSocket connection closed.');
          _isConnected = false;
        },
      );
    } catch (e) {
      debugPrint('Failed to connect to Second Voice Engine: $e');
      _isConnected = false;
    }
  }

  void sendTranscriptChunk(String transcript) {
    if (_isConnected && _channel != null && transcript.trim().isNotEmpty) {
      _channel!.sink.add(transcript);
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _isConnected = false;
  }

  void dispose() {
    disconnect();
    _analysisController.close();
  }
}