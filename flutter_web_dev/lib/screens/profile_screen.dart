import 'package:flutter/material.dart';

import '../i18n/i18n.dart';
import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<Map<String, dynamic>> _dishes = const [];
  List<Map<String, dynamic>> _ingredients = const [];
  bool _loading = true;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      return;
    }
    _started = true;
    //Refreshing during build would notify the scope mid-frame.
    WidgetsBinding.instance.addPostFrameCallback((_) => _prepare());
  }

  Future<void> _prepare() async {
    if (!mounted) {
      return;
    }
    final state = AppScope.of(context);
    if (!state.isSignedIn) {
      await state.refreshAccount();
    }
    if (!mounted) {
      return;
    }
    if (!state.isSignedIn) {
      Navigator.pushReplacementNamed(context, '/signin');
      return;
    }
    await _loadMine(state);
  }

  Future<void> _loadMine(AppState state) async {
    setState(() => _loading = true);
    try {
      final dishes = await state.api.getJson('/api/dish/profile/mine');
      final ingredients = await state.api.getJson('/api/ingredient/profile/mine');
      if (!mounted) {
        return;
      }
      setState(() {
        _dishes = _rows(dishes);
        _ingredients = _rows(ingredients);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _dishes = const [];
        _ingredients = const [];
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  List<Map<String, dynamic>> _rows(dynamic payload) {
    if (payload is! List) {
      return const [];
    }
    return payload.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList();
  }

  String _label(Map<String, dynamic> row, String locale) {
    return I18n.label('${row['name_vi'] ?? ''}', '${row['name'] ?? ''}', locale);
  }

  String _joined(String value) {
    final date = DateTime.tryParse(value);
    if (date == null) {
      return '';
    }
    return '${date.day}/${date.month}/${date.year}';
  }

  Future<void> _signOut() async {
    final state = AppScope.of(context);
    await state.signOut();
    if (!mounted) {
      return;
    }
    Navigator.pushReplacementNamed(context, '/');
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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(state.account?.username ?? state.t('profile.title'), style: Theme.of(context).textTheme.titleLarge),
                    if (_joined(state.account?.createdAt ?? '').isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        state.t('profile.joined', {'date': _joined(state.account?.createdAt ?? '')}),
                        style: TextStyle(fontSize: 13, color: tokens.dim),
                      ),
                    ],
                  ],
                ),
              ),
              BoardButton(label: state.t('nav.signOut'), onPressed: _signOut),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            Text(state.t('common.loading'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else
            LayoutBuilder(builder: (context, constraints) {
              final wide = constraints.maxWidth >= 1024;
              final dishes = _list(state, tokens, state.t('profile.myDishes'), _dishes, state.t('profile.noPosts'));
              final ingredients = _list(state, tokens, state.t('profile.myIngredients'), _ingredients, state.t('profile.noPosts'));
              if (!wide) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [dishes, const SizedBox(height: 16), ingredients],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: dishes),
                  const SizedBox(width: 16),
                  Expanded(child: ingredients),
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _list(AppState state, BoardTokens tokens, String title, List<Map<String, dynamic>> rows, String empty) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title.toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
        const SizedBox(height: 8),
        if (rows.isEmpty)
          Text(empty, style: TextStyle(fontSize: 13, color: tokens.dim))
        else
          BoardCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final row in rows)
                  Container(
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: tokens.line))),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _label(row, state.locale),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 14, color: tokens.ink),
                          ),
                        ),
                        if (row['is_best_post'] == true)
                          BoardChip(label: state.t('profile.best')),
                      ],
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
