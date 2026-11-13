import 'package:flutter/material.dart';
import 'deepfake_scanner.dart';

class VerificationHub extends StatelessWidget {
  const VerificationHub({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reality Check & Verification Hub')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: ListView(
          children: const [
            DeepfakeScannerView(),
            SizedBox(height: 20),
            ListTile(
              leading: Icon(Icons.verified_user, color: Colors.greenAccent),
              title: Text('Official Agency Directory'),
              subtitle: Text('Direct encrypted helpline mapping for CBI, Cyber Cell, and RBI.'),
            ),
            ListTile(
              leading: Icon(Icons.policy, color: Colors.amberAccent),
              title: Text('Digital Arrest Protocol Fact-Check'),
              subtitle: Text('No law enforcement agency in India conducts video interrogation or demands deposits.'),
            ),
          ],
        ),
      ),
    );
  }
}