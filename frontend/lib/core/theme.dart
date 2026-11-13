import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xFF090D16),
      primaryColor: const Color(0xFFEF4444),
      colorScheme: const ColorScheme.dark(
        primary: Color(0xFFEF4444),
        secondary: Color(0xFF3B82F6),
        surface: Color(0xFF0F172A),
      ),
      fontFamily: 'Roboto',
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF0F172A),
        elevation: 0,
        centerTitle: true,
      ),
    );
  }
}