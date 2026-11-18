import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../editor/blocks_editor.dart';
import '../editor/editor_api.dart';
import '../editor/editor_image_field.dart';
import '../shell/app_shell.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

///Create a dish, or add/edit a post for an existing dish.
class DishEditorScreen extends StatefulWidget {
  const DishEditorScreen({super.key, this.dishId = '', this.pickImage});

  final String dishId;
  final ImagePicker? pickImage;

  @override
  State<DishEditorScreen> createState() => _DishEditorScreenState();
}

class _DishEditorScreenState extends State<DishEditorScreen> {
  final _name = TextEditingController();
  final _nameVi = TextEditingController();
  final _short = TextEditingController();
  final _shortVi = TextEditingController();
  final List<IngredientRef> _catalog = [];
  final List<IngredientRef> _chosen = [];
  final List<EditorBlock> _blocks = [];
  final List<String> _images = [];
  final Map<String, String> _grams = {};
  final TextEditingController _servings = TextEditingController(text: '4');
  String _cover = '';
  String _query = '';
  bool _autoTranslate = false;
  bool _busy = false;
  bool _loading = true;
  bool _loadFailed = false;
  bool _started = false;
  String? _error;

  bool get _creating => widget.dishId.isEmpty;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      return;
    }
    _started = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => _prepare());
  }

  Future<void> _prepare() async {
    final state = AppScope.of(context);
    if (!state.isSignedIn) {
      await state.refreshAccount();
    }
    if (!mounted) {
      return;
    }
    if (!state.isSignedIn) {
      Navigator.pushReplacementNamed(context, '/signin', arguments: {'next': _nextRoute()});
      return;
    }
    await _load(state);
  }

  String _nextRoute() => _creating ? '/dish-edit' : '/dish-edit?dish_id=${widget.dishId}';

  Future<void> _load(AppState state) async {
    setState(() => _loading = true);
    try {
      final catalog = await state.api.getJson('/api/ingredient/selection/');
      final ingredients = IngredientRef.listFromJson(catalog);
      if (!_creating) {
        final dish = await state.api.getJson('/api/dish/profile/get_dish/${widget.dishId}');
        if (dish is Map) {
          _name.text = '${dish['name'] ?? ''}';
          _nameVi.text = '${dish['name_vi'] ?? ''}';
          final postId = '${dish['best_post_id'] ?? ''}';
          if (postId.isNotEmpty) {
            final post = await state.api.getJson('/api/dish/profile/get_dish_post/$postId');
            final parsed = DishPost.fromJson(post, fallbackName: _name.text);
            if (parsed.nameVi.trim().isNotEmpty) {
              _nameVi.text = parsed.nameVi;
            }
            _short.text = parsed.shortDetail;
            _shortVi.text = parsed.shortDetailVi;
            _cover = parsed.image;
            _images
              ..clear()
              ..addAll(parsed.extraImages);
            final ids = parsed.ingredientIds;
            if (ids.isNotEmpty) {
              final rows = await state.api.getJson('/api/ingredient/search/ids/${ids.join('-')}');
              _chosen
                ..clear()
                ..addAll(IngredientRef.listFromJson(rows));
            } else {
              _chosen.clear();
            }
            _blocks
              ..clear()
              ..addAll(parsed.blocks.map((block) => EditorBlock.fromJson(block.toJson())));
            if (parsed.servings > 0) {
              _servings.text = '${parsed.servings}';
            }
            for (final row in parsed.ingredientAmounts) {
              _grams['${row['ingredient_id']}'] = '${row['grams']}';
            }
          }
        }
      }
      if (!mounted) {
        return;
      }
      setState(() {
        _catalog
          ..clear()
          ..addAll(ingredients);
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = state.t('common.errorBody');
          _loadFailed = true;
        });
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _save() async {
    final state = AppScope.of(context);
    final name = _name.text.trim();
    final nameVi = _nameVi.text.trim();
    if (_busy || _loadFailed) {
      return;
    }
    if (name.isEmpty && nameVi.isEmpty) {
      setState(() => _error = state.t('auth.invalid'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final payload = <String, dynamic>{
        'name': name,
        'name_vi': nameVi,
        'short_detail': _short.text,
        'short_detail_vi': _shortVi.text,
        'profile_image': _cover,
        'images': _images,
        'ingredients': _chosen.map((item) => item.id).toList(),
        'servings': int.tryParse(_servings.text) ?? 0,
        'ingredient_amounts': [
          for (final item in _chosen)
            {'ingredient_id': item.id, 'grams': double.tryParse(_grams[item.id] ?? '') ?? 0}
        ],
        'nutrition': _perServing().toJson(),
        'display_blocks': _blocks.map((block) => block.toJson()).toList(),
      };
      if (_creating) {
        final response = await state.api.postJson('/api/dish/profile/create_dish', payload);
        final dishId = response is Map ? '${response['dish_id'] ?? ''}' : '';
        if (dishId.isEmpty) {
          throw EditorException('save');
        }
        if (!mounted) {
          return;
        }
        Navigator.pushReplacementNamed(context, '/dish', arguments: {'dish_id': dishId});
      } else {
        final response = await state.api.postJson('/api/dish/profile/create_dish_post', {
          'dish_id': widget.dishId,
          'data': payload,
        });
        final status = response is Map && response['status'] is num ? (response['status'] as num).toInt() : -1;
        if (status != 0 && status != 1) {
          final detail = response is Map ? '${response['detail'] ?? ''}' : '';
          throw EditorException('save', serverMessage: detail.isEmpty ? null : detail);
        }
        if (!mounted) {
          return;
        }
        Navigator.pushReplacementNamed(context, '/dish', arguments: {'dish_id': widget.dishId});
      }
    } on ApiException catch (error) {
      if (error.statusCode == 401) {
        await state.refreshAccount();
        if (mounted) {
          Navigator.pushReplacementNamed(context, '/signin', arguments: {'next': _nextRoute()});
        }
        return;
      }
      if (mounted) {
        setState(() => _error = error.message);
      }
    } on EditorException catch (error) {
      if (mounted) {
        setState(() => _error = error.serverMessage ?? state.t('common.errorBody'));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = state.t('common.errorBody'));
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _handleImageError(String kind) async {
    final state = AppScope.of(context);
    if (kind == 'auth') {
      await state.refreshAccount();
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/signin', arguments: {'next': _nextRoute()});
      }
      return;
    }
    if (mounted) {
      setState(() => _error = state.t('common.errorBody'));
    }
  }

  Future<String> _translate(String text, String source, String target) async {
    return EditorApi(AppScope.of(context).api).translate(text, source, target);
  }

  Future<void> _translateField(TextEditingController from, TextEditingController to) async {
    if (!_autoTranslate || from.text.trim().isEmpty || to.text.trim().isNotEmpty) {
      return;
    }
    try {
      final text = await _translate(from.text.trim(), 'en', 'vi');
      if (mounted && to.text.trim().isEmpty) {
        setState(() => to.text = text);
      }
    } on EditorException {
      if (mounted) {
        setState(() => _error = AppScope.of(context).t('edit.translateFailed'));
      }
    }
  }

  Nutrition _perServing() {
    var total = const Nutrition();
    for (final item in _chosen) {
      final grams = double.tryParse(_grams[item.id] ?? '') ?? 0;
      if (grams <= 0) {
        continue;
      }
      final per100 = item.nutrition;
      total = total +
          Nutrition(
            calories: per100.calories * grams / 100,
            protein: per100.protein * grams / 100,
            fat: per100.fat * grams / 100,
            carbs: per100.carbs * grams / 100,
            fiber: per100.fiber * grams / 100,
            sodium: per100.sodium * grams / 100,
          );
    }
    final servings = int.tryParse(_servings.text) ?? 0;
    return servings > 0 ? Nutrition.scaled(total, 1 / servings) : total;
  }

  @override
  void dispose() {
    _servings.dispose();
    _name.dispose();
    _nameVi.dispose();
    _short.dispose();
    _shortVi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);
    final filtered = _catalog
        .where((item) => _query.trim().isEmpty || item.label(state.locale).toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return AppShell(
      active: '/dishes',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(_creating ? state.t('edit.createTitle') : state.t('edit.titleEditDish'),
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          if (_loading)
            Text(state.t('common.loading'), style: TextStyle(fontSize: 13, color: tokens.dim))
          else ...[
            BoardCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Checkbox(
                        value: _autoTranslate,
                        onChanged: (value) => setState(() => _autoTranslate = value ?? false),
                      ),
                      Expanded(child: Text(state.t('edit.autoTranslate'), style: TextStyle(fontSize: 13, color: tokens.ink))),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _field(state, _name, state.t('edit.nameEn'), onBlur: () => _translateField(_name, _nameVi)),
                  const SizedBox(height: 10),
                  _field(state, _nameVi, state.t('edit.nameVi')),
                  const SizedBox(height: 10),
                  _field(state, _short, state.t('edit.shortEn'), onBlur: () => _translateField(_short, _shortVi)),
                  const SizedBox(height: 10),
                  _field(state, _shortVi, state.t('edit.shortVi')),
                  const SizedBox(height: 14),
                  Text(state.t('edit.ingredients').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 32,
                    child: TextField(
                      onChanged: (value) => setState(() => _query = value),
                      style: TextStyle(fontSize: 13, color: tokens.ink),
                      decoration: InputDecoration(hintText: state.t('home.pickerPlaceholder')),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final item in filtered)
                        BoardChip(
                          label: '${_chosen.any((row) => row.id == item.id) ? '−' : '+'} ${item.label(state.locale)}',
                          active: _chosen.any((row) => row.id == item.id),
                          onTap: () {
                            setState(() {
                              if (_chosen.any((row) => row.id == item.id)) {
                                _chosen.removeWhere((row) => row.id == item.id);
                              } else {
                                _chosen.add(item);
                              }
                            });
                          },
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(state.t('edit.nutrition').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
                  const SizedBox(height: 6),
                  SizedBox(
                    width: 120,
                    height: 34,
                    child: TextField(
                      key: const ValueKey('dish-servings'),
                      controller: _servings,
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setState(() {}),
                      style: TextStyle(fontSize: 13, color: tokens.ink),
                      decoration: InputDecoration(labelText: state.t('edit.servings')),
                    ),
                  ),
                  const SizedBox(height: 8),
                  for (final item in _chosen)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(item.label(state.locale), style: TextStyle(fontSize: 13, color: tokens.ink)),
                          ),
                          SizedBox(
                            width: 110,
                            height: 34,
                            child: TextFormField(
                              key: ValueKey('dish-grams-${item.id}'),
                              initialValue: _grams[item.id] ?? '',
                              keyboardType: TextInputType.number,
                              onChanged: (value) => setState(() => _grams[item.id] = value),
                              style: TextStyle(fontSize: 13, color: tokens.ink),
                              decoration: InputDecoration(labelText: state.t('edit.grams')),
                            ),
                          ),
                        ],
                      ),
                    ),
                  Text(
                    '${_perServing().calories.round()} kcal · P ${_perServing().protein.toStringAsFixed(1)}g · F ${_perServing().fat.toStringAsFixed(1)}g · C ${_perServing().carbs.toStringAsFixed(1)}g',
                    style: TextStyle(fontSize: 12, color: tokens.dim),
                  ),
                  const SizedBox(height: 14),
                  Text(state.t('edit.image').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
                  const SizedBox(height: 6),
                  EditorImageField(
                    api: EditorApi(state.api),
                    label: state.t('edit.dropCover'),
                    value: _cover,
                    pickImage: widget.pickImage,
                    onChanged: (path) => setState(() => _cover = path),
                    onError: _handleImageError,
                  ),
                  const SizedBox(height: 14),
                  Text(state.t('edit.extraImages').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
                  const SizedBox(height: 6),
                  EditorImageField(
                    api: EditorApi(state.api),
                    label: state.t('edit.dropCover'),
                    pickImage: widget.pickImage,
                    onChanged: (path) {
                      if (path.isNotEmpty) {
                        setState(() => _images.add(path));
                      }
                    },
                    onError: _handleImageError,
                  ),
                  if (_images.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (var index = 0; index < _images.length; index++)
                          Stack(
                            children: [
                              BoardImage(url: state.api.imageUrl(_images[index]), width: 72, height: 72),
                              Positioned(
                                right: 0,
                                top: 0,
                                child: InkWell(
                                  onTap: () => setState(() => _images.removeAt(index)),
                                  child: Container(
                                    color: Colors.black54,
                                    child: const Icon(Icons.close, size: 14, color: Colors.white),
                                  ),
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  const SizedBox(height: 14),
                  Text(state.t('edit.blocks').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
                  const SizedBox(height: 6),
                  BlocksEditor(
                    blocks: _blocks,
                    pickImage: widget.pickImage,
                    autoTranslate: _autoTranslate,
                    translate: (text, source, target) => _translate(text, source, target),
                    onChanged: (next) => setState(() {
                      _blocks
                        ..clear()
                        ..addAll(next);
                    }),
                    onImageError: (_) => setState(() => _error = state.t('common.errorBody')),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: TextStyle(fontSize: 13, color: tokens.danger)),
            ],
            const SizedBox(height: 14),
            Row(
              children: [
                BoardButton(
                  key: const ValueKey('dish-save'),
                  label: _busy ? state.t('common.loading') : (_creating ? state.t('edit.createAction') : state.t('common.save')),
                  primary: true,
                  onPressed: _busy ? null : _save,
                ),
                const SizedBox(width: 8),
                BoardButton(label: state.t('common.cancel'), onPressed: () {
                  if (Navigator.canPop(context)) {
                    Navigator.pop(context);
                  } else {
                    Navigator.pushReplacementNamed(context, '/dishes');
                  }
                }),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _field(AppState state, TextEditingController controller, String label, {VoidCallback? onBlur}) {
    final tokens = BoardTokens.of(state.isLight);
    return Focus(
      onFocusChange: (hasFocus) {
        if (!hasFocus) {
          onBlur?.call();
        }
      },
      child: TextField(
        controller: controller,
        style: TextStyle(fontSize: 13, color: tokens.ink),
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}
