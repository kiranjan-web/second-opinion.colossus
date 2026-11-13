import 'package:flutter/material.dart';
import 'pdf_generator.dart';

class ReportHistoryView extends StatelessWidget {
  const ReportHistoryView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Evidence Vault & Incident History')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: ListView(
          children: [
            const Text(
              'Past Coercion Incidents Logged Locally',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 12),
            Card(
              color: const Color(0xFF1E293B),
              child: ListTile(
                leading: const Icon(Icons.security, color: Colors.redAccent),
                title: const Text('Digital Arrest Scam Attempt'),
                subtitle: const Text('Phase 5 Reached • Isolated • 2 Triggers Logged'),
                trailing: IconButton(
                  icon: const Icon(Icons.picture_as_pdf, color: Colors.blueAccent),
                  onPressed: () async {
                    final path = await EvidencePdfGenerator.generateIncidentReportPdf(
                      highestPhase: 5,
                      isolationBreached: true,
                      triggers: [
                        "Disconnect all family members",
                        "Go to a separate quiet room and face the wall"
                      ],
                    );
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(path != null ? 'PDF Saved: $path' : 'Export failed')),
                      );
                    }
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}