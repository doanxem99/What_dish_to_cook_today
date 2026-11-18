import 'package:flutter/material.dart';

import '../api/api_client.dart';
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
  int _points = 0;
  bool _voted = false;
  bool _voteBusy = false;
  bool _voteError = false;
  bool _commentBusy = false;
  bool _deleteBusy = false;
  bool _commentError = false;
  late final TextEditingController _comment;

  @override
  void initState() {
    super.initState();
    _comment = TextEditingController();
  }

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

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
        if (!mounted) {
          return;
        }
        setState(() {
          _post = null;
          _loading = false;
        });
        return;
      }
      final payload = await state.api.getJson('/api/dish/profile/get_dish_post/$postId');
      final post = DishPost.fromJson(payload, fallbackName: fallbackName);
      if (post.id.isEmpty) {
        if (!mounted) {
          return;
        }
        setState(() {
          _post = null;
          _loading = false;
        });
        return;
      }
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
        _points = post.points;
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

  Future<bool> _reloadComments() async {
    final state = AppScope.of(context);
    final post = _post;
    if (post == null) {
      return false;
    }
    try {
      final rows = await state.api.getJson('/api/dish/profile/comments/${post.id}');
      if (!mounted) {
        return false;
      }
      setState(() {
        _comments = rows is List ? rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList() : const [];
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _submitComment() async {
    final state = AppScope.of(context);
    final post = _post;
    final body = _comment.text.trim();
    if (post == null || body.isEmpty || _commentBusy) {
      return;
    }
    setState(() {
      _commentBusy = true;
      _commentError = false;
    });
    try {
      final payload = await state.api.postJson('/api/dish/profile/comment/${post.id}', {'body': body});
      if (!mounted) {
        return;
      }
      _comment.clear();
      final saved = payload is Map ? Map<String, dynamic>.from(payload) : null;
      if (saved != null && saved['id'] != null && saved['body'] != null) {
        //The POST answer is the comment itself; no second request can lose it.
        setState(() => _comments = [..._comments, saved]);
      } else if (!await _reloadComments() && mounted) {
        setState(() => _commentError = true);
      }
    } catch (error) {
      if (error is ApiException && error.statusCode == 401) {
        await state.refreshAccount();
      }
      if (mounted) {
        setState(() => _commentError = true);
      }
    } finally {
      if (mounted) {
        setState(() => _commentBusy = false);
      }
    }
  }

  Future<void> _deleteComment(Map<String, dynamic> comment) async {
    final state = AppScope.of(context);
    if (_deleteBusy) {
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        content: Text(state.t('dish.commentDeleteConfirm')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text(state.t('common.cancel'))),
          TextButton(onPressed: () => Navigator.pop(dialogContext, true), child: Text(state.t('common.delete'))),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }
    setState(() {
      _deleteBusy = true;
      _commentError = false;
    });
    try {
      await state.api.deleteJson('/api/dish/profile/comment/${comment['id']}');
      if (!await _reloadComments() && mounted) {
        setState(() => _commentError = true);
      }
    } catch (error) {
      if (error is ApiException && error.statusCode == 401) {
        await state.refreshAccount();
      }
      if (!mounted) {
        return;
      }
      if (error is ApiException && error.statusCode == 404) {
        //The row is already gone on the server; drop it here too.
        setState(() => _comments = _comments.where((row) => row['id'] != comment['id']).toList());
      } else {
        await _reloadComments();
        if (mounted) {
          setState(() => _commentError = true);
        }
      }
    } finally {
      if (mounted) {
        setState(() => _deleteBusy = false);
      }
    }
  }

  String _dishNext() {
    final post = _post;
    return post == null ? '/dishes' : '/dish?post_id=${post.id}';
  }

  Future<void> _vote() async {
    final state = AppScope.of(context);
    final post = _post;
    if (post == null) {
      return;
    }
    if (!state.isSignedIn) {
      Navigator.pushNamed(context, '/signin', arguments: {'next': _dishNext()});
      return;
    }
    if (_voteBusy) {
      return;
    }
    setState(() {
      _voteBusy = true;
      _voteError = false;
    });
    try {
      final payload = await state.api.postJson('/api/dish/profile/vote/${post.id}', const {});
      if (!mounted) {
        return;
      }
      final data = payload is Map ? payload : const {};
      setState(() {
        _voted = data['voted'] == true;
        if (data['points'] is num) {
          _points = (data['points'] as num).toInt();
        }
      });
    } catch (error) {
      if (error is ApiException && error.statusCode == 401) {
        await state.refreshAccount();
      }
      if (mounted) {
        setState(() => _voteError = true);
      }
      //The count stays as it was; the button can be pressed again.
    } finally {
      if (mounted) {
        setState(() => _voteBusy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return AppShell(
      active: '/dishes',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
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
      crossAxisAlignment: CrossAxisAlignment.stretch,
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
              if (post.username.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(state.t('dish.author', {'name': post.username}), style: TextStyle(fontSize: 12, color: tokens.dim)),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Text('$_points', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: tokens.ink)),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      state.t('dish.vote').toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (state.isSignedIn)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: InkWell(
                        onTap: () => Navigator.pushNamed(context, '/dish-edit', arguments: {'dish_id': post.dishId}),
                        child: Text(state.t('common.edit'), style: TextStyle(fontSize: 12, color: tokens.dim)),
                      ),
                    ),
                  BoardButton(
                    key: const ValueKey('vote-button'),
                    label: _voted ? state.t('dish.voted') : state.t('dish.vote'),
                    primary: _voted,
                    onPressed: _voteBusy ? null : _vote,
                  ),
                ],
              ),
              if (_voteError)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(state.t('common.errorBody'), style: TextStyle(fontSize: 12, color: tokens.danger)),
                ),
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
        const SizedBox(height: 16),
        BoardCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(state.t('dish.commentsTitle').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
              const SizedBox(height: 8),
              if (state.isSignedIn) ...[
                TextField(
                  key: const ValueKey('comment-body'),
                  controller: _comment,
                  onChanged: (_) {
                    if (_commentError) {
                      setState(() => _commentError = false);
                    }
                  },
                  maxLines: 3,
                  maxLength: 1000,
                  style: TextStyle(fontSize: 13, color: tokens.ink),
                  decoration: InputDecoration(hintText: state.t('dish.commentPlaceholder')),
                ),
                if (_commentError)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(state.t('common.errorBody'), style: TextStyle(fontSize: 13, color: tokens.danger)),
                  ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _comment,
                    builder: (context, value, _) => BoardButton(
                      key: const ValueKey('comment-submit'),
                      label: _commentBusy ? state.t('common.loading') : state.t('dish.commentSubmit'),
                      primary: true,
                      onPressed: (_commentBusy || value.text.trim().isEmpty) ? null : _submitComment,
                    ),
                  ),
                ),
              ] else
                InkWell(
                  onTap: () => Navigator.pushNamed(context, '/signin', arguments: {'next': _dishNext()}),
                  child: Text(state.t('dish.commentSignIn'), style: TextStyle(fontSize: 13, color: tokens.amber)),
                ),
              const SizedBox(height: 10),
              if (_comments.isEmpty)
                Text(state.t('dish.commentEmpty'), style: TextStyle(fontSize: 13, color: tokens.dim))
              else
                for (final comment in _comments)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text('${comment['username'] ?? ''}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: tokens.ink)),
                            ),
                            if (comment['is_mine'] == true)
                              InkWell(
                                key: ValueKey('comment-delete-${comment['id']}'),
                                onTap: () => _deleteComment(comment),
                                child: Text(state.t('common.delete'), style: TextStyle(fontSize: 12, color: tokens.dim)),
                              ),
                          ],
                        ),
                        Text('${comment['body'] ?? ''}', style: TextStyle(fontSize: 13, color: tokens.ink)),
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
