import 'package:flutter/material.dart';

import '../shell/app_shell.dart';
import '../state/app_state.dart';

class IngredientDetailScreen extends StatelessWidget {
  const IngredientDetailScreen({super.key, this.ingredientId = ''});

  final String ingredientId;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return AppShell(
      active: '/ingredients',
      child: Text(state.t('common.loading'), style: Theme.of(context).textTheme.bodyMedium),
    );
  }
}
