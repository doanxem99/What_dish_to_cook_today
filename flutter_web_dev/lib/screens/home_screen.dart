import 'dart:async';

import 'package:flutter/material.dart';

import '../api/models.dart';
import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

const _types = ['Food', 'Spice', 'Fruit', 'Other'];

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _search = TextEditingController();
  final List<IngredientRef> _catalog = [];
  final List<IngredientRef> _found = [];
  DishPost? _best;

  bool _loading = true;
  bool _failed = false;
  bool _loadingBest = true;
  bool _needIngredient = false;
  bool _started = false;
  Timer? _debounce;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      return;
    }
    _started = true;
    _loadCatalog();
    _loadBest();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _loadCatalog() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final payload = await AppScope.of(context).api.getJson('/api/ingredient/selection/');
      if (!mounted) {
        return;
      }
      setState(() => _catalog
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

  Future<void> _loadBest() async {
    try {
      final payload = await AppScope.of(context).api.getJson('/api/dish/profile/get_best_dish_post');
      if (!mounted) {
        return;
      }
      setState(() {
        _best = payload == null ? null : DishPost.fromJson(payload);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _best = null);
    } finally {
      if (mounted) {
        setState(() => _loadingBest = false);
      }
    }
  }

  void _queueSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () => _searchIngredients(value));
  }

  Future<void> _searchIngredients(String value) async {
    final term = value.trim();
    if (term.isEmpty) {
      setState(() => _found.clear());
      return;
    }
    try {
      final payload = await AppScope.of(context).api.getJson('/api/ingredient/search/keyword/${Uri.encodeComponent(term)}');
      if (!mounted) {
        return;
      }
      setState(() => _found
        ..clear()
        ..addAll(IngredientRef.listFromJson(payload)));
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _found.clear());
    }
  }

  void _choose(IngredientRef ingredient) {
    final state = AppScope.of(context);
    state.toggleIngredient(ingredient.toBasketItem());
    setState(() => _needIngredient = false);
  }

  void _find() {
    final state = AppScope.of(context);
    if (state.basket.isEmpty) {
      setState(() => _needIngredient = true);
      return;
    }
    Navigator.pushNamed(context, '/dishes');
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);
    final source = _search.text.trim().isEmpty ? _catalog : _found;
    final groups = <String, List<IngredientRef>>{};
    for (final type in _types) {
      final rows = source.where((item) => item.type == type).toList();
      if (rows.isNotEmpty) {
        groups[type] = rows;
      }
    }

    final picker = BoardCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.t('home.pickerTitle').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
          const SizedBox(height: 8),
          SizedBox(
            height: 34,
            child: TextField(
              controller: _search,
              onChanged: _queueSearch,
              style: TextStyle(fontSize: 13, color: tokens.ink),
              decoration: InputDecoration(hintText: state.t('home.pickerPlaceholder')),
            ),
          ),
          if (_loading) _stateLine(state.t('common.loading')),
          if (_failed) ...[
            _stateLine(state.t('common.errorBody')),
            BoardButton(label: state.t('common.retry'), onPressed: _loadCatalog),
          ],
          if (!_loading && !_failed && groups.isEmpty) _stateLine(state.t('common.emptyTitle')),
          for (final entry in groups.entries) ...[
            const SizedBox(height: 12),
            Text(state.t('ingredients.${entry.key.toLowerCase()}').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final item in entry.value)
                  BoardChip(
                    label: '${state.isChosen(item.id) ? '−' : '+'} ${item.label(state.locale)}',
                    active: state.isChosen(item.id),
                    onTap: () => _choose(item),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 20),
          Row(
            children: [
              Text(state.t('home.find').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
              const Spacer(),
              if (state.basket.isNotEmpty)
                GestureDetector(
                  onTap: () => setState(state.clearBasket),
                  child: Text(state.t('home.clear'), style: TextStyle(fontSize: 12, color: tokens.dim)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (state.basket.isEmpty)
            Text(state.t('home.chosenEmpty'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final item in state.basket)
                  BoardChip(
                    label: item.label(state.locale),
                    onRemove: () => setState(() => state.removeIngredient(item.id)),
                  ),
              ],
            ),
          if (_needIngredient) ...[
            const SizedBox(height: 8),
            Text(state.t('home.needOne'), style: TextStyle(fontSize: 13, color: tokens.danger)),
          ],
          const SizedBox(height: 12),
          BoardButton(label: state.t('home.find'), primary: true, onPressed: _find),
          if (state.basket.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              state.t('home.ready', {'n': '${state.basket.length}'}).toUpperCase(),
              style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim),
            ),
          ],
        ],
      ),
    );

    final aside = BoardCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.t('home.dishOfDay').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
          if (_loadingBest)
            _stateLine(state.t('common.loading'))
          else if (_best == null)
            _stateLine(state.t('common.emptyTitle'))
          else ...[
            const SizedBox(height: 8),
            Text(_best!.label(state.locale), style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(_best!.detail(state.locale), style: TextStyle(fontSize: 13, color: tokens.dim)),
            const SizedBox(height: 12),
            BoardButton(
              label: state.t('common.open'),
              onPressed: () => Navigator.pushNamed(context, '/dish', arguments: {'post_id': _best!.id}),
            ),
          ],
          const SizedBox(height: 20),
          Text(state.t('home.howTitle').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
          const SizedBox(height: 8),
          Text('1. ${state.t('home.how1')}\n2. ${state.t('home.how2')}\n3. ${state.t('home.how3')}', style: TextStyle(fontSize: 13, height: 1.6, color: tokens.dim)),
        ],
      ),
    );

    return AppShell(
      active: '/',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.t('home.title'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: Text(state.t('home.subtitle'), style: TextStyle(fontSize: 14, color: tokens.dim)),
          ),
          const SizedBox(height: 16),
          LayoutBuilder(builder: (context, constraints) {
            if (constraints.maxWidth >= 1024) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 2, child: picker),
                  const SizedBox(width: 16),
                  Expanded(flex: 1, child: aside),
                ],
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [picker, const SizedBox(height: 16), aside],
            );
          }),
        ],
      ),
    );
  }

  Widget _stateLine(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(text, style: TextStyle(fontSize: 13, color: Theme.of(context).textTheme.bodySmall?.color)),
    );
  }
}
