import 'package:flutter/material.dart';

class GlslBackground extends StatelessWidget {
  final Widget child;

  const GlslBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF090D16),
            Color(0xFF0F172A),
            Color(0xFF1E1B4B),
          ],
        ),
      ),
      child: child,
    );
  }
}