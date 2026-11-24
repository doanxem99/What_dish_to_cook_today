import 'package:flutter/material.dart';

import '../ai/ai_api.dart';
import '../ai/ai_models.dart';
import '../api/api_client.dart';
import '../editor/editor_api.dart';
import '../editor/editor_image_field.dart';
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
  bool _failed = false;
  bool _started = false;
  bool _checked = false;
  bool _redirecting = false;
  bool _signingOut = false;
  String? _error;
  AiStatus? _ai;
  List<AiEventRow> _events = const <AiEventRow>[];
  int _eventPage = 1;
  int _eventTotal = 0;
  bool _historyLoading = false;
  bool _historyFailed = false;

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
    _checked = true;
    if (!state.isSignedIn) {
      _redirectToSignIn();
      return;
    }
    await _loadMine(state);
    await _loadAi(state);
  }

  ///Assistant state is optional: a deployment without AI answers 404 here and
  ///the section simply does not render.
  Future<void> _loadAi(AppState state) async {
    setState(() => _historyLoading = true);
    try {
      final api = AiApi(state.api);
      final status = await api.status();
      final events = await api.listEvents(1);
      if (!mounted) return;
      setState(() {
        _ai = status;
        _events = events.rows;
        _eventPage = events.page;
        _eventTotal = events.total;
        _historyLoading = false;
        _historyFailed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _ai = null;
        _historyLoading = false;
      });
    }
  }

  Future<void> _setCapability(AppState state, String capability) async {
    try {
      final saved = await AiApi(state.api).setCapability(capability);
      if (!mounted) return;
      setState(() {
        _ai = AiStatus(
            enabled: _ai?.enabled ?? true, capability: saved, quota: _ai?.quota ?? const AiQuota());
      });
    } catch (_) {
      if (mounted) setState(() => _error = state.t('common.errorBody'));
    }
  }

  Future<void> _deleteConversation(AppState state) async {
    try {
      await AiApi(state.api).clearConversation();
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => _error = state.t('common.errorBody'));
    }
  }

  Future<void> _loadEventsPage(AppState state, int page) async {
    setState(() => _historyLoading = true);
    try {
      final events = await AiApi(state.api).listEvents(page);
      if (!mounted) return;
      setState(() {
        _events = events.rows;
        _eventPage = events.page;
        _eventTotal = events.total;
        _historyLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        _historyLoading = false;
        _historyFailed = true;
      });
    }
  }

  Future<void> _clearHistory(AppState state) async {
    try {
      await AiApi(state.api).clearEvents();
      if (mounted) setState(() => _events = const <AiEventRow>[]);
    } catch (_) {
      if (mounted) setState(() => _historyFailed = true);
    }
  }

  void _redirectToSignIn() {
    if (_redirecting || _signingOut) {
      return;
    }
    _redirecting = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      //A sign-out navigates home; this screen is no longer current.
      final route = ModalRoute.of(context);
      if (route != null && !route.isCurrent) {
        return;
      }
      Navigator.pushReplacementNamed(context, '/signin', arguments: {'next': '/profile'});
    });
  }

  Future<void> _loadMine(AppState state) async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    var failed = false;
    var unauthorised = false;

    Future<List<dynamic>> safe(String path) async {
      try {
        final payload = await state.api.getJson(path);
        return payload is List ? payload : const [];
      } catch (error) {
        failed = true;
        if (error is ApiException && error.statusCode == 401) {
          unauthorised = true;
        }
        return const [];
      }
    }

    final results = await Future.wait([
      safe('/api/dish/profile/mine'),
      safe('/api/ingredient/profile/mine'),
    ]);
    if (!mounted) {
      return;
    }
    if (unauthorised) {
      //Only an expired session sends the user away; a 500 keeps the page up.
      await state.refreshAccount();
      if (!mounted) {
        return;
      }
      if (!state.isSignedIn) {
        _redirectToSignIn();
        return;
      }
    }
    setState(() {
      _dishes = _rows(results[0]);
      _ingredients = _rows(results[1]);
      _failed = failed;
      _loading = false;
    });
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

  String _joined(String value, String locale) {
    final date = DateTime.tryParse(value)?.toLocal();
    if (date == null) {
      return '';
    }
    if (locale == 'vi') {
      return '${date.day}/${date.month}/${date.year}';
    }
    return MaterialLocalizations.of(context).formatShortDate(date);
  }

  Future<void> _signOut() async {
    final state = AppScope.of(context);
    //The guest guard would otherwise race this navigation.
    _signingOut = true;
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
    final current = ModalRoute.of(context)?.isCurrent ?? true;
    if (_checked && current && !state.isSignedIn && !_signingOut) {
      _redirectToSignIn();
    }

    return AppShell(
      active: '/profile',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: 150,
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              border: Border.all(color: tokens.line),
              borderRadius: BorderRadius.circular(BoardTokens.radius),
              color: tokens.raised,
              image: (state.account?.backgroundImage.isNotEmpty ?? false)
                  ? DecorationImage(
                      image: NetworkImage(state.api.imageUrl(state.account!.backgroundImage)),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            alignment: Alignment.bottomRight,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                color: Colors.black54,
                child: EditorImageField(
                  api: EditorApi(state.api),
                  label: state.t('profile.changeCover'),
                  value: '',
                  height: 32,
                  onChanged: (path) async {
                    if (path.isEmpty) {
                      return;
                    }
                    try {
                      await state.api.postJson('/api/auth/background', {'background_image': path});
                      await state.refreshAccount();
                    } catch (_) {
                      if (mounted) {
                        setState(() => _error = state.t('common.errorBody'));
                      }
                    }
                  },
                  onError: (_) {
                    if (mounted) {
                      setState(() => _error = state.t('common.errorBody'));
                    }
                  },
                ),
              ),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: tokens.red,
                child: Text(
                  (state.account?.username.isNotEmpty ?? false)
                      ? state.account!.username[0].toUpperCase()
                      : '?',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state.account?.username ?? state.t('profile.title'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    if (_joined(state.account?.createdAt ?? '', state.locale).isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        state.t('profile.joined', {'date': _joined(state.account?.createdAt ?? '', state.locale)}),
                        style: TextStyle(fontSize: 13, color: tokens.dim),
                      ),
                    ],
                  ],
                ),
              ),
              BoardButton(label: state.t('nav.signOut'), onPressed: _signOut),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 6),
            Text(_error!, style: TextStyle(fontSize: 13, color: tokens.danger)),
          ],
          if (_ai != null && _ai!.enabled) ...[
            const SizedBox(height: 16),
            _aiSection(state, tokens),
          ],
          const SizedBox(height: 16),
          if (!_checked || _loading)
            Text(state.t('common.loading'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else if (_failed)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(state.t('common.errorBody'), style: TextStyle(fontSize: 13, color: tokens.dim)),
                const SizedBox(height: 8),
                BoardButton(label: state.t('common.retry'), onPressed: () => _loadMine(state)),
              ],
            )
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

  Widget _aiSection(AppState state, BoardTokens tokens) {
    final ai = _ai!;
    final quota = ai.quota;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: tokens.line),
        borderRadius: BorderRadius.circular(BoardTokens.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(state.t('profile.aiTitle'),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(state.t('profile.aiUsage', {
                'used': '${quota.used}',
                'limit': '${quota.limit}',
              }), style: TextStyle(fontSize: 12, color: tokens.dim)),
            ],
          ),
          const SizedBox(height: 8),
          Text(state.t('profile.capability'), style: TextStyle(fontSize: 13, color: tokens.dim)),
          DropdownButton<String>(
            isExpanded: true,
            value: askCapabilities.contains(ai.capability) ? ai.capability : 'read_only',
            items: [
              for (final level in askCapabilities)
                DropdownMenuItem<String>(
                  value: level,
                  child: Text(state.t('ask.capability.$level'), overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (value) {
              if (value != null) _setCapability(state, value);
            },
          ),
          Row(
            children: [
              Flexible(
                child: BoardButton(
                  label: state.t('profile.deleteConversation'),
                  onPressed: () => _confirmThen(
                    state,
                    state.t('profile.deleteConversationConfirm'),
                    () => _deleteConversation(state),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(state.t('profile.historyTitle'),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              if (_events.isNotEmpty)
                BoardButton(
                  label: state.t('profile.clearHistory'),
                  onPressed: () => _confirmThen(
                    state,
                    state.t('profile.clearHistoryConfirm'),
                    () => _clearHistory(state),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          if (_historyLoading)
            Text(state.t('common.loading'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else if (_historyFailed)
            Text(state.t('profile.historyLoadError'),
                style: TextStyle(fontSize: 13, color: tokens.danger))
          else if (_events.isEmpty)
            Text(state.t('profile.historyEmpty'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else
            for (final row in _events)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Wrap(
                  spacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(_shortDate(row.createdAt),
                        style: TextStyle(fontSize: 12, color: tokens.dim)),
                    Text(state.t(eventTypeKey(row.type)), style: const TextStyle(fontSize: 13)),
                    if (row.label(state.locale).isNotEmpty)
                      InkWell(
                        onTap: row.canNavigate
                            ? () => Navigator.pushNamed(
                                  context,
                                  row.targetType == 'dish' ? '/dish' : '/ingredient',
                                  arguments: {
                                    'dish_id': row.targetId,
                                    'ingredient_id': row.targetId,
                                  },
                                )
                            : null,
                        child: Text(row.label(state.locale),
                            style: TextStyle(
                                fontSize: 13,
                                color: row.canNavigate ? tokens.amber : tokens.ink)),
                      ),
                  ],
                ),
              ),
          if (_eventTotal > 25)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  BoardButton(
                    label: state.t('profile.prev'),
                    onPressed: _eventPage > 1 && !_historyLoading
                        ? () => _loadEventsPage(state, _eventPage - 1)
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Text('${state.t('profile.page')} $_eventPage',
                      style: TextStyle(fontSize: 12, color: tokens.dim)),
                  const SizedBox(width: 8),
                  BoardButton(
                    label: state.t('profile.next'),
                    onPressed: _eventPage * 25 < _eventTotal && !_historyLoading
                        ? () => _loadEventsPage(state, _eventPage + 1)
                        : null,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _confirmThen(AppState state, String question, Future<void> Function() action) async {
    final agreed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(question),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(state.t('common.cancel'))),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(state.t('common.confirm'))),
        ],
      ),
    );
    if (agreed == true) await action();
  }

  String _shortDate(String iso) {
    if (iso.length < 10) return iso;
    return iso.substring(0, 10);
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

