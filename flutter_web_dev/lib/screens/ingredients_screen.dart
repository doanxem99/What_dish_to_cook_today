import 'package:flutter/material.dart';

import '../shell/app_shell.dart';
import '../state/app_state.dart';

class IngredientsScreen extends StatelessWidget {
  const IngredientsScreen({super.key, this.query = ''});

  final String query;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return AppShell(
      active: '/ingredients',
      query: query,
      child: Text(state.t('common.loading'), style: Theme.of(context).textTheme.bodyMedium),
    );
  }
}
