import 'package:flutter/material.dart';

import '../api/models.dart';
import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

class DishesScreen extends StatefulWidget {
  const DishesScreen({super.key, this.query = ''});

  final String query;

  @override
  State<DishesScreen> createState() => _DishesScreenState();
}

class _DishesScreenState extends State<DishesScreen> {
  final List<DishPreview> _rows = [];
  bool _loading = true;
  bool _failed = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      return;
    }
    _started = true;
    _load();
  }

  Future<void> _load() async {
    final state = AppScope.of(context);
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final dynamic payload;
      if (widget.query.trim().isNotEmpty) {
        payload = await state.api.getJson('/api/dish/search/keyword/${Uri.encodeComponent(widget.query.trim())}');
      } else if (state.basket.isNotEmpty) {
        final ids = state.basket.map((item) => item.id).join('-');
        payload = await state.api.getJson('/api/dish/selection/ingredients/$ids');
      } else {
        payload = await state.api.getJson('/api/dish/selection/');
      }
      if (!mounted) {
        return;
      }
      final rows = DishPreview.listFromJson(payload)
        ..sort((a, b) {
          final byMatch = b.matchCount.compareTo(a.matchCount);
          return byMatch != 0 ? byMatch : a.label(state.locale).compareTo(b.label(state.locale));
        });
      setState(() {
        _rows
          ..clear()
          ..addAll(rows);
      });
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

  void _open(DishPreview row) {
    Navigator.pushNamed(context, '/dish', arguments: {'dish_id': row.id});
  }

  String _lamp(DishPreview row) {
    if (row.totalIngredients == 0) {
      return 'partial';
    }
    if (row.matchCount == row.totalIngredients) {
      return 'ok';
    }
    return row.matchCount > 0 ? 'partial' : 'missing';
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);
    final heading = widget.query.trim().isNotEmpty
        ? state.t('dishes.resultsFor', {'q': widget.query})
        : (state.basket.isNotEmpty ? state.t('dishes.board') : state.t('dishes.title'));

    return AppShell(
      active: '/dishes',
      query: widget.query,
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
                    Text(heading, style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 4),
                    Text(state.t('dishes.subtitle'), style: TextStyle(fontSize: 13, color: tokens.dim)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _viewSwitch(state, tokens),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            _stateLine(state.t('common.loading'))
          else if (_failed)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _stateLine(state.t('common.errorBody')),
                BoardButton(label: state.t('common.retry'), onPressed: _load),
              ],
            )
          else if (_rows.isEmpty)
            _stateLine(widget.query.trim().isNotEmpty
                ? state.t('dishes.noMatches', {'q': widget.query})
                : state.t('dishes.emptyCatalog'))
          else
            LayoutBuilder(builder: (context, constraints) {
              final wide = constraints.maxWidth >= 640;
              if (state.view == 'grid') {
                final columns = constraints.maxWidth >= 1024 ? 3 : (wide ? 2 : 1);
                final cardWidth = (constraints.maxWidth - (columns - 1) * 12) / columns;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    for (final row in _rows) SizedBox(width: cardWidth, child: _gridCard(row, state, tokens)),
                  ],
                );
              }
              return Column(
                children: [
                  for (final row in _rows) _listRow(row, state, tokens, wide),
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _viewSwitch(AppState state, BoardTokens tokens) {
    Widget button(String view, IconData icon, String label) {
      final active = state.view == view;
      return Tooltip(
        message: label,
        child: InkWell(
          onTap: () => state.setView(view),
          child: Container(
            width: 32,
            height: 28,
            decoration: BoxDecoration(
              border: Border.all(color: active ? tokens.amber : tokens.line),
              borderRadius: BorderRadius.circular(BoardTokens.radius),
            ),
            child: Icon(icon, size: 16, color: active ? tokens.amber : tokens.dim),
          ),
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        button('list', Icons.view_list_outlined, state.t('dishes.listView')),
        const SizedBox(width: 4),
        button('grid', Icons.grid_view_outlined, state.t('dishes.gridView')),
      ],
    );
  }

  Widget _listRow(DishPreview row, AppState state, BoardTokens tokens, bool wide) {
    return Container(
      key: ValueKey('row-${row.id}'),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: tokens.line))),
      child: InkWell(
        onTap: () => _open(row),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: Row(
            children: [
              MatchLamp(kind: _lamp(row)),
              const SizedBox(width: 8),
              SizedBox(
                width: 34,
                child: Text(
                  row.totalIngredients == 0 ? '' : '${row.matchCount}/${row.totalIngredients}',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: tokens.ink),
                ),
              ),
              const SizedBox(width: 8),
              BoardImage(
                url: AppScope.of(context).api.imageUrl(row.image),
                width: 44,
                height: 44,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      row.label(state.locale),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: tokens.ink),
                    ),
                    if (wide && row.detail(state.locale).isNotEmpty)
                      Text(
                        row.detail(state.locale),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, color: tokens.dim),
                      ),
                    if (row.ingredientLine(state.locale).isNotEmpty)
                      Text(
                        row.ingredientLine(state.locale),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, color: tokens.dim),
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

  Widget _gridCard(DishPreview row, AppState state, BoardTokens tokens) {
    final detail = row.detail(state.locale);
    return Container(
      key: ValueKey('card-${row.id}'),
      decoration: BoxDecoration(
        color: tokens.raised,
        border: Border.all(color: tokens.line),
        borderRadius: BorderRadius.circular(BoardTokens.radius),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _open(row),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            BoardImage(url: AppScope.of(context).api.imageUrl(row.image), width: double.infinity, height: 128),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      MatchLamp(kind: _lamp(row)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          row.label(state.locale),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: tokens.ink),
                        ),
                      ),
                      if (row.totalIngredients > 0)
                        Text('${row.matchCount}/${row.totalIngredients}', style: TextStyle(fontSize: 12, color: tokens.dim)),
                    ],
                  ),
                  if (detail.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Tooltip(
                      message: detail,
                      child: Text(
                        detail,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, height: 1.4, color: tokens.dim),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
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
