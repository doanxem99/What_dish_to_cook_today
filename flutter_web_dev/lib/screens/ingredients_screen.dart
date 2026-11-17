import 'dart:async';

import 'package:flutter/material.dart';

import '../api/models.dart';
import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

const _types = ['Food', 'Spice', 'Fruit', 'Other'];

class IngredientsScreen extends StatefulWidget {
  const IngredientsScreen({super.key, this.query = ''});

  final String query;

  @override
  State<IngredientsScreen> createState() => _IngredientsScreenState();
}

class _IngredientsScreenState extends State<IngredientsScreen> {
  final TextEditingController _search = TextEditingController();
  final List<IngredientRef> _items = [];
  bool _loading = true;
  bool _failed = false;
  bool _started = false;
  Timer? _debounce;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      return;
    }
    _started = true;
    _search.text = widget.query;
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final state = AppScope.of(context);
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final term = _search.text.trim();
      final payload = term.isEmpty
          ? await state.api.getJson('/api/ingredient/selection/')
          : await state.api.getJson('/api/ingredient/search/keyword/${Uri.encodeComponent(term)}');
      if (!mounted) {
        return;
      }
      setState(() => _items
        ..clear()
        ..addAll(IngredientRef.listFromJson(payload)));
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _failed = true);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _queueSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), _load);
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);
    final groups = <String, List<IngredientRef>>{};
    for (final type in _types) {
      final rows = _items.where((item) => item.type == type).toList();
      if (rows.isNotEmpty) {
        groups[type] = rows;
      }
    }

    return AppShell(
      active: '/ingredients',
      query: widget.query,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.t('ingredients.title'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(state.t('ingredients.subtitle'), style: TextStyle(fontSize: 13, color: tokens.dim)),
          const SizedBox(height: 12),
          SizedBox(
            height: 34,
            child: TextField(
              controller: _search,
              onChanged: _queueSearch,
              onSubmitted: (_) => _load(),
              style: TextStyle(fontSize: 13, color: tokens.ink),
              decoration: InputDecoration(hintText: state.t('home.pickerPlaceholder')),
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            _stateLine(state.t('common.loading'))
          else if (_failed)
            _stateLine(state.t('common.errorBody'))
          else if (groups.isEmpty)
            _stateLine(_search.text.trim().isEmpty
                ? state.t('common.emptyTitle')
                : state.t('ingredients.empty', {'q': _search.text.trim()}))
          else
            for (final entry in groups.entries) ...[
              Text(state.t('ingredients.${entry.key.toLowerCase()}').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
              const SizedBox(height: 6),
              BoardCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final item in entry.value) _row(item, state, tokens),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
        ],
      ),
    );
  }

  Widget _row(IngredientRef item, AppState state, BoardTokens tokens) {
    return Container(
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: tokens.line))),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/ingredient', arguments: {'ingredient_id': item.id}),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              BoardImage(url: state.api.imageUrl(item.image), width: 44, height: 44),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.label(state.locale),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: tokens.ink),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stateLine(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(text, style: TextStyle(fontSize: 13, color: Theme.of(context).textTheme.bodySmall?.color)),
    );
  }
}
