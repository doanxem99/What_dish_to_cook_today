import 'package:flutter/material.dart';

import '../shell/app_shell.dart';
import '../state/app_state.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return AppShell(
      active: '/',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.t('home.title'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(state.t('home.subtitle'), style: TextStyle(color: Theme.of(context).textTheme.bodySmall?.color)),
        ],
      ),
    );
  }
}
