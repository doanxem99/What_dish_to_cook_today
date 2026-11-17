import 'package:flutter/material.dart';

import '../api/models.dart';
import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

class HomemadeScreen extends StatefulWidget {
  const HomemadeScreen({super.key});

  @override
  State<HomemadeScreen> createState() => _HomemadeScreenState();
}

class _HomemadeScreenState extends State<HomemadeScreen> {
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
      final payload = await state.api.getJson('/api/dish/selection/homemade');
      if (!mounted) {
        return;
      }
      setState(() => _rows
        ..clear()
        ..addAll(DishPreview.listFromJson(payload)));
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

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return AppShell(
      active: '/homemade',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.t('homemade.title'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(state.t('homemade.subtitle'), style: TextStyle(fontSize: 13, color: tokens.dim)),
          const SizedBox(height: 16),
          if (_loading)
            Text(state.t('common.loading'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else if (_failed)
            Text(state.t('common.errorBody'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else if (_rows.isEmpty)
            Text(state.t('homemade.empty'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else
            BoardCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final row in _rows)
                    Container(
                      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: tokens.line))),
                      child: InkWell(
                        onTap: () => Navigator.pushNamed(context, '/dish', arguments: {'dish_id': row.id}),
                        child: Padding(
                          padding: const EdgeInsets.all(8),
                          child: Row(
                            children: [
                              BoardImage(url: state.api.imageUrl(row.image), width: 44, height: 44),
                              const SizedBox(width: 12),
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
                                    if (row.detail(state.locale).isNotEmpty)
                                      Text(
                                        row.detail(state.locale),
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
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
