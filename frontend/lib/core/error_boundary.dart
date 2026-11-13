import 'package:flutter/material.dart';

class ShieldErrorBoundary extends StatefulWidget {
  final Widget child;

  const ShieldErrorBoundary({super.key, required this.child});

  @override
  State<ShieldErrorBoundary> createState() => _ShieldErrorBoundaryState();
}

class _ShieldErrorBoundaryState extends State<ShieldErrorBoundary> {
  bool _hasError = false;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    FlutterError.onError = (FlutterErrorDetails details) {
      if (mounted) {
        setState(() {
          _hasError = true;
          _errorMessage = details.exceptionAsString();
        });
      }
    };
  }

  void _resetShield() {
    setState(() {
      _hasError = false;
      _errorMessage = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return Scaffold(
        backgroundColor: const Color(0xFF090D16),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.shield_outlined, color: Colors.amber, size: 64),
                const SizedBox(height: 16),
                const Text(
                  'Fail-Safe Mode Engaged',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                Text(
                  _errorMessage,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _resetShield,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Restore Active Shield'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return widget.child;
  }
}