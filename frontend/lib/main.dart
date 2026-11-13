import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'features/protection/active_shield_view.dart';
import 'features/reality_check/verification_hub.dart';
import 'features/evidence_vault/report_history.dart';

void main() {
  runApp(const SecondVoiceApp());
}

class SecondVoiceApp extends StatelessWidget {
  const SecondVoiceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Second Voice Colossus',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const MainNavigationShell(),
    );
  }
}

class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const ActiveShieldView(),
    const VerificationHub(),
    const ReportHistoryView(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        backgroundColor: const Color(0xFF0F172A),
        selectedItemColor: Colors.redAccent,
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.security),
            label: 'Active Shield',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.mic_external_on),
            label: 'Reality Check',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.folder_shared),
            label: 'Evidence Vault',
          ),
        ],
      ),
    );
  }
}