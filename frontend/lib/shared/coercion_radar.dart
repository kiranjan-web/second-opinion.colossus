import 'package:flutter/material.dart';

class CoercionRadarWidget extends StatelessWidget {
  final int currentPhase;

  const CoercionRadarWidget({super.key, required this.currentPhase});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 200,
      height: 200,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: currentPhase >= 5 ? Colors.redAccent : Colors.blueAccent,
          width: 3,
        ),
        color: (currentPhase >= 5 ? Colors.red : Colors.blue).withOpacity(0.1),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              currentPhase >= 5 ? Icons.warning_rounded : Icons.radar,
              size: 48,
              color: currentPhase >= 5 ? Colors.redAccent : Colors.blueAccent,
            ),
            const SizedBox(height: 8),
            Text(
              'PHASE $currentPhase / 7',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 16),
            ),
          ],
        ),
      ),
    );
  }
}