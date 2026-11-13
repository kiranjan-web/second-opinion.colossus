import 'package:flutter/material.dart';

class DeepfakeScannerView extends StatelessWidget {
  const DeepfakeScannerView({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.blueAccent.withOpacity(0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.mic_external_on, color: Colors.blueAccent, size: 48),
          const SizedBox(height: 16),
          const Text(
            'Synthetic Voice & Video Authenticator',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 8),
          const Text(
            'Upload or capture suspicious audio/video samples to verify whether the caller is a synthetic AI voice clone.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Analyzing audio spectral artifacts against PyTorch model...')),
              );
            },
            icon: const Icon(Icons.upload_file),
            label: const Text('Scan Audio File for Clones'),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent),
          ),
        ],
      ),
    );
  }
}