import 'package:flutter/material.dart';

import '../api/models.dart';
import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

class IngredientDetailScreen extends StatefulWidget {
  const IngredientDetailScreen({super.key, this.ingredientId = ''});

  final String ingredientId;

  @override
  State<IngredientDetailScreen> createState() => _IngredientDetailScreenState();
}

class _IngredientDetailScreenState extends State<IngredientDetailScreen> {
  IngredientRef? _ingredient;
  DishPost? _post;
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
      final payload = await state.api.getJson('/api/ingredient/profile/get_ingredient/${widget.ingredientId}');
      final map = payload is Map ? payload : const <String, dynamic>{};
      final ingredient = IngredientRef.fromJson({
        'id': map['_id'] ?? widget.ingredientId,
        'name': map['name'],
        'name_vi': map['name_vi'],
        'type': map['type'],
        'profile_image': map['profile_image'],
      });
      final bestPostId = (map['best_post_id'] ?? '').toString();
      DishPost? post;
      if (bestPostId.isNotEmpty) {
        final postPayload = await state.api.getJson('/api/ingredient/profile/get_ingredient_post/$bestPostId');
        post = DishPost.fromJson(postPayload, fallbackName: ingredient.name);
      }
      if (!mounted) {
        return;
      }
      setState(() {
        _ingredient = ingredient;
        _post = post;
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

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return AppShell(
      active: '/ingredients',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_loading)
            Text(state.t('common.loading'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else if (_failed)
            Text(state.t('common.errorBody'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else if (_ingredient == null)
            Text(state.t('common.emptyTitle'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else ...[
            Text(_ingredient!.label(state.locale), style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            BoardCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final block in _post?.blocks ?? const <DisplayBlock>[]) ...[
                    if (block.type == 'text')
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          block.label(state.locale),
                          style: TextStyle(
                            fontSize: block.fontSize,
                            height: 1.6,
                            color: tokens.ink,
                            fontWeight: block.bold ? FontWeight.w700 : FontWeight.w400,
                            fontStyle: block.italic ? FontStyle.italic : FontStyle.normal,
                          ),
                        ),
                      )
                    else if (block.type == 'image')
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: BoardImage(url: state.api.imageUrl(block.src), width: double.infinity, height: 220),
                      ),
                  ],
                  if (_post == null || _post!.blocks.isEmpty)
                    Text(state.t('common.emptyTitle'), style: TextStyle(fontSize: 13, color: tokens.dim)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
