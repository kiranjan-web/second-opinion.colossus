import 'package:flutter/material.dart';

class AnimatedTimelineView extends StatelessWidget {
  final int activePhase;

  const AnimatedTimelineView({super.key, required this.activePhase});

  @override
  Widget build(BuildContext context) {
    final stages = [
      "Hook",
      "Authority Impersonation",
      "Accusation",
      "Intimidation",
      "Isolation",
      "Forced Surveillance",
      "Financial Coercion"
    ];

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: stages.length,
      itemBuilder: (context, index) {
        final phaseNumber = index + 1;
        final isActive = phaseNumber <= activePhase;

        return ListTile(
          leading: CircleAvatar(
            backgroundColor: isActive ? Colors.redAccent : Colors.grey.shade800,
            child: Text('$phaseNumber', style: const TextStyle(color: Colors.white)),
          ),
          title: Text(
            stages[index],
            style: TextStyle(
              color: isActive ? Colors.white : Colors.white54,
              fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        );
      },
    );
  }
}