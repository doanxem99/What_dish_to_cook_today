import 'package:flutter/material.dart';

import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return AppShell(
      active: '/about',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.t('about.title'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 768),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final key in ['about.body1', 'about.body2', 'about.body3', 'about.body4'])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Text(key.isEmpty ? '' : state.t(key), style: TextStyle(fontSize: 14, height: 1.7, color: tokens.ink)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
