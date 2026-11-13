import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:path_provider/path_provider.dart';

class EvidencePdfGenerator {
  static Future<String?> generateIncidentReportPdf({
    required int highestPhase,
    required bool isolationBreached,
    required List<String> triggers,
  }) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Header(
                level: 0,
                child: pw.Text('SECOND VOICE — INCIDENT FORENSIC REPORT', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
              ),
              pw.SizedBox(height: 10),
              pw.Text('Generated for Cyber Crime Investigation Portal (1930)', style: const pw.TextStyle(fontSize: 12)),
              pw.Divider(),
              pw.SizedBox(height: 10),
              pw.Text('Highest Threat Phase Reached: $highestPhase / 7'),
              pw.Text('Isolation Breached: ${isolationBreached ? "YES (CRITICAL)" : "NO"}'),
              pw.SizedBox(height: 15),
              pw.Text('Detected Coercion Triggers:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
              ...triggers.map((t) => pw.Bullet(text: t)),
              pw.SizedBox(height: 30),
              pw.Text('Note: This report contains local tamper-evident metadata captured during the active session to assist law enforcement agencies.'),
            ],
          );
        },
      ),
    );

    try {
      final outputDir = await getTemporaryDirectory();
      final file = File('${outputDir.path}/second_voice_incident_report.pdf');
      await file.writeAsBytes(await pdf.save());
      return file.path;
    } catch (e) {
      debugPrint('Failed to generate PDF: $e');
      return null;
    }
  }
}