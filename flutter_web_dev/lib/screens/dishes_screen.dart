import 'package:flutter/material.dart';

import '../shell/app_shell.dart';
import '../state/app_state.dart';

class DishesScreen extends StatelessWidget {
  const DishesScreen({super.key, this.query = ''});

  final String query;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return AppShell(
      active: '/dishes',
      query: query,
      child: Text(state.t('common.loading'), style: Theme.of(context).textTheme.bodyMedium),
    );
  }
}
