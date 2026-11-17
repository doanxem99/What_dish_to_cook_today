import 'package:flutter/material.dart';

import '../api/models.dart';
import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

class DishDetailScreen extends StatefulWidget {
  const DishDetailScreen({super.key, this.dishId = '', this.postId = ''});

  final String dishId;
  final String postId;

  @override
  State<DishDetailScreen> createState() => _DishDetailScreenState();
}

class _DishDetailScreenState extends State<DishDetailScreen> {
  DishPost? _post;
  List<IngredientRef> _ingredients = const [];
  List<Map<String, dynamic>> _comments = const [];
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
      var postId = widget.postId;
      var fallbackName = '';
      if (postId.isEmpty && widget.dishId.isNotEmpty) {
        final dish = await state.api.getJson('/api/dish/profile/get_dish/${widget.dishId}');
        if (dish is Map) {
          postId = (dish['best_post_id'] ?? '').toString();
          fallbackName = (dish['name'] ?? '').toString();
        }
      }
      if (postId.isEmpty) {
        setState(() {
          _post = null;
          _loading = false;
        });
        return;
      }
      final payload = await state.api.getJson('/api/dish/profile/get_dish_post/$postId');
      final post = DishPost.fromJson(payload, fallbackName: fallbackName);
      var ingredients = <IngredientRef>[];
      if (post.ingredientIds.isNotEmpty) {
        final rows = await state.api.getJson('/api/ingredient/search/ids/${post.ingredientIds.join('-')}');
        ingredients = IngredientRef.listFromJson(rows);
      }
      var comments = <Map<String, dynamic>>[];
      try {
        final rows = await state.api.getJson('/api/dish/profile/comments/$postId');
        if (rows is List) {
          comments = rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList();
        }
      } catch (_) {
        comments = [];
      }
      if (!mounted) {
        return;
      }
      setState(() {
        _post = post;
        _ingredients = ingredients;
        _comments = comments;
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

  Color _blockColor(String name, BoardTokens tokens) {
    switch (name) {
      case 'white':
        return Colors.white;
      case 'red':
        return tokens.danger;
      case 'blue':
        return Colors.blue;
      case 'green':
        return tokens.green;
      default:
        return tokens.ink;
    }
  }

  TextAlign _blockAlign(String name) {
    switch (name) {
      case 'center':
        return TextAlign.center;
      case 'right':
        return TextAlign.right;
      default:
        return TextAlign.left;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return AppShell(
      active: '/dishes',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_loading)
            Text(state.t('common.loading'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else if (_failed)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(state.t('common.errorBody'), style: TextStyle(fontSize: 13, color: tokens.dim)),
                const SizedBox(height: 8),
                BoardButton(label: state.t('common.retry'), onPressed: _load),
              ],
            )
          else if (_post == null)
            Text(state.t('dish.notFound'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else
            _body(state, tokens, _post!),
        ],
      ),
    );
  }

  Widget _body(AppState state, BoardTokens tokens, DishPost post) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        BoardCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(post.label(state.locale), style: Theme.of(context).textTheme.titleLarge),
              if (post.detail(state.locale).isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(post.detail(state.locale), style: TextStyle(fontSize: 14, color: tokens.dim)),
              ],
              if (post.image.isNotEmpty) ...[
                const SizedBox(height: 16),
                BoardImage(
                  url: state.api.imageUrl(post.image),
                  width: double.infinity,
                  height: 260,
                  fit: BoxFit.cover,
                ),
              ],
              if (post.extraImages.isNotEmpty) ...[
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final path in post.extraImages)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: BoardImage(url: state.api.imageUrl(path), width: 80, height: 80),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        if (_ingredients.isNotEmpty) ...[
          const SizedBox(height: 16),
          BoardCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(state.t('dish.ingredients').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final item in _ingredients)
                      BoardChip(label: item.label(state.locale), active: state.isChosen(item.id)),
                  ],
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        BoardCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final block in post.blocks) ...[
                if (block.type == 'text')
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(
                      block.label(state.locale),
                      textAlign: _blockAlign(block.align),
                      style: TextStyle(
                        fontSize: block.fontSize,
                        height: 1.6,
                        color: _blockColor(block.color, tokens),
                        fontWeight: block.bold ? FontWeight.w700 : FontWeight.w400,
                        fontStyle: block.italic ? FontStyle.italic : FontStyle.normal,
                      ),
                    ),
                  )
                else if (block.type == 'image')
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        BoardImage(url: state.api.imageUrl(block.src), width: double.infinity, height: 220),
                        if (block.label(state.locale).isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(block.label(state.locale), style: TextStyle(fontSize: 12, color: tokens.dim)),
                        ],
                      ],
                    ),
                  ),
              ],
              if (post.blocks.isEmpty)
                Text(state.t('common.emptyTitle'), style: TextStyle(fontSize: 13, color: tokens.dim)),
            ],
          ),
        ),
        if (_comments.isNotEmpty) ...[
          const SizedBox(height: 16),
          BoardCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(state.t('dish.commentsTitle').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
                const SizedBox(height: 8),
                for (final comment in _comments)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${comment['username'] ?? ''}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: tokens.ink)),
                        Text('${comment['body'] ?? ''}', style: TextStyle(fontSize: 13, color: tokens.ink)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
