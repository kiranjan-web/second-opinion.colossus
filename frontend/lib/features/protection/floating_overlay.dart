import 'package:flutter/material.dart';

class FloatingAlertOverlay extends StatelessWidget {
  final int currentPhase;
  final String riskLevel;
  final String fingerprint;
  final VoidCallback onBreakCall;

  const FloatingAlertOverlay({
    super.key,
    required this.currentPhase,
    required this.riskLevel,
    required this.fingerprint,
    required this.onBreakCall,
  });

  @override
  Widget build(BuildContext context) {
    final bool isCritical = currentPhase >= 5;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isCritical ? const Color(0xFF450A0A) : const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCritical ? Colors.redAccent : Colors.amberAccent,
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: (isCritical ? Colors.red : Colors.amber).withOpacity(0.35),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(
                isCritical ? Icons.warning_amber_rounded : Icons.radar,
                color: isCritical ? Colors.redAccent : Colors.amberAccent,
                size: 32,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isCritical
                          ? 'DIGITAL ARREST CIRCUIT BREAKER'
                          : 'COERCION WARNING • PHASE $currentPhase/7',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      fingerprint,
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (isCritical) ...[
            const SizedBox(height: 16),
            const Text(
              'Real Police, CBI, and RBI NEVER conduct arrests over Skype or WhatsApp video calls.',
              style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onBreakCall,
                icon: const Icon(Icons.call_end, color: Colors.white),
                label: const Text(
                  'TERMINATE CALL & ALERT FAMILY',
                  style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}