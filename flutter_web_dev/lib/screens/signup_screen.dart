import 'package:flutter/material.dart';

import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final TextEditingController _username = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final state = AppScope.of(context);
    final username = _username.text.trim();
    final email = _email.text.trim();
    if (username.isEmpty || email.isEmpty || _password.text.isEmpty || _password.text != _confirm.text) {
      setState(() => _error = state.t('auth.invalid'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final error = await state.signUp(username, email, _password.text);
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
    Navigator.pushReplacementNamed(context, '/');
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
                Text(state.t('auth.signUpTitle'), style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 16),
                _field(state, _username, state.t('auth.username'), false, false),
                const SizedBox(height: 10),
                _field(state, _email, state.t('auth.email'), false, false),
                const SizedBox(height: 10),
                _field(state, _password, state.t('auth.password'), true, false),
                const SizedBox(height: 10),
                _field(state, _confirm, state.t('auth.confirmPassword'), true, true),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!, style: TextStyle(fontSize: 13, color: tokens.danger)),
                ],
                const SizedBox(height: 16),
                BoardButton(
                  label: _busy ? state.t('common.loading') : state.t('auth.submitSignUp'),
                  primary: true,
                  onPressed: _busy ? null : _submit,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text(state.t('auth.haveAccount'), style: TextStyle(fontSize: 13, color: tokens.dim)),
                    const SizedBox(width: 6),
                    InkWell(
                      onTap: () => Navigator.pushReplacementNamed(context, '/signin'),
                      child: Text(state.t('nav.signIn'), style: TextStyle(fontSize: 13, color: tokens.amber)),
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

  Widget _field(AppState state, TextEditingController controller, String label, bool secret, bool last) {
    return TextField(
      controller: controller,
      obscureText: secret,
      style: TextStyle(fontSize: 13, color: BoardTokens.of(state.isLight).ink),
      decoration: InputDecoration(labelText: label),
      onSubmitted: last ? (_) => _submit() : null,
    );
  }
}
