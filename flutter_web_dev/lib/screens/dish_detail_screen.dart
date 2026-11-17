import 'package:flutter/material.dart';

import '../shell/app_shell.dart';
import '../state/app_state.dart';

class DishDetailScreen extends StatelessWidget {
  const DishDetailScreen({super.key, this.dishId = '', this.postId = ''});

  final String dishId;
  final String postId;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return AppShell(
      active: '/dishes',
      child: Text(state.t('common.loading'), style: Theme.of(context).textTheme.bodyMedium),
    );
  }
}
