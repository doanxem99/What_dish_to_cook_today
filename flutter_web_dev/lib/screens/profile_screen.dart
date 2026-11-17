import 'package:flutter/material.dart';

import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      return;
    }
    _started = true;
    final state = AppScope.of(context);
    if (!state.isSignedIn) {
      state.refreshAccount();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);
    return AppShell(
      active: '/profile',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.t('profile.title'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Text(
            state.account?.username ?? state.t('nav.signIn'),
            style: TextStyle(fontSize: 14, color: tokens.ink),
          ),
        ],
      ),
    );
  }
}
