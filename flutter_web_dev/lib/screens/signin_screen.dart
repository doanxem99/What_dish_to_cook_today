import 'package:flutter/material.dart';

import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final TextEditingController _username = TextEditingController();
  final TextEditingController _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) {
      return;
    }
    final state = AppScope.of(context);
    if (_username.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = state.t('auth.invalid'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final error = await state.signIn(_username.text.trim(), _password.text);
    if (!mounted) {
      return;
    }
    if (error != null) {
      setState(() {
        _busy = false;
        _error = error;
      });
      return;
    }
    Navigator.pushReplacementNamed(context, _nextRoute());
  }

  String _nextRoute() {
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is Map && arguments['next'] is String) {
      return arguments['next'] as String;
    }
    return '/';
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return AppShell(
      active: '',
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 512),
          child: BoardCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(state.t('auth.signInTitle'), style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 16),
                _field(state, _username, state.t('auth.username'), false),
                const SizedBox(height: 10),
                _field(state, _password, state.t('auth.password'), true),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!, style: TextStyle(fontSize: 13, color: tokens.danger)),
                ],
                const SizedBox(height: 16),
                BoardButton(
                  key: const ValueKey('signin-submit'),
                  label: _busy ? state.t('common.loading') : state.t('auth.submitSignIn'),
                  primary: true,
                  onPressed: _busy ? null : _submit,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text(state.t('auth.needAccount'), style: TextStyle(fontSize: 13, color: tokens.dim)),
                    const SizedBox(width: 6),
                    InkWell(
                      onTap: () => Navigator.pushReplacementNamed(context, '/signup', arguments: ModalRoute.of(context)?.settings.arguments),
                      child: Text(state.t('nav.signUp'), style: TextStyle(fontSize: 13, color: tokens.amber)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(AppState state, TextEditingController controller, String label, bool secret) {
    return TextField(
      key: ValueKey(secret ? 'signin-password' : 'signin-username'),
      controller: controller,
      obscureText: secret,
      autofillHints: secret ? const [AutofillHints.password] : const [AutofillHints.username],
      style: TextStyle(fontSize: 13, color: BoardTokens.of(state.isLight).ink),
      decoration: InputDecoration(labelText: label),
      onSubmitted: (_) => _submit(),
    );
  }
}
