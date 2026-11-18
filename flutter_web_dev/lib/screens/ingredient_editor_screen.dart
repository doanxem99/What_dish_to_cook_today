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

///Create an ingredient, or add/edit a post for an existing one.
class IngredientEditorScreen extends StatefulWidget {
  const IngredientEditorScreen({super.key, this.ingredientId = '', this.pickImage});

  final String ingredientId;
  final ImagePicker? pickImage;

  @override
  State<IngredientEditorScreen> createState() => _IngredientEditorScreenState();
}

class _IngredientEditorScreenState extends State<IngredientEditorScreen> {
  final _name = TextEditingController();
  final _nameVi = TextEditingController();
  final _short = TextEditingController();
  final _shortVi = TextEditingController();
  final _nutritionDescription = TextEditingController();
  final Map<String, TextEditingController> _nutrition = {
    'calories': TextEditingController(),
    'protein': TextEditingController(),
    'fat': TextEditingController(),
    'carbs': TextEditingController(),
    'fiber': TextEditingController(),
    'sodium': TextEditingController(),
  };
  final List<EditorBlock> _blocks = [];
  String _type = 'Other';
  bool _autoTranslate = false;
  String _image = '';
  bool _loading = true;
  bool _loadFailed = false;
  bool _busy = false;
  bool _started = false;
  String? _error;

  bool get _creating => widget.ingredientId.isEmpty;

  static const _types = ['Food', 'Spice', 'Fruit', 'Other'];

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

  String _nextRoute() =>
      _creating ? '/ingredient-edit' : '/ingredient-edit?ingredient_id=${widget.ingredientId}';

  Future<void> _load(AppState state) async {
    setState(() => _loading = true);
    try {
      if (!_creating) {
        final payload = await state.api.getJson('/api/ingredient/profile/get_ingredient/${widget.ingredientId}');
        final map = payload is Map ? payload : const <String, dynamic>{};
        _name.text = '${map['name'] ?? ''}';
        _nameVi.text = '${map['name_vi'] ?? ''}';
        _type = _types.contains('${map['type'] ?? ''}') ? '${map['type']}' : 'Other';
        _image = '${map['profile_image'] ?? ''}';
        final postId = '${map['best_post_id'] ?? ''}';
        if (postId.isNotEmpty) {
          final post = await state.api.getJson('/api/ingredient/profile/get_ingredient_post/$postId');
          final parsed = DishPost.fromJson(post, fallbackName: _name.text);
          if (parsed.type.isNotEmpty && _types.contains(parsed.type)) {
            _type = parsed.type;
          }
          if (parsed.nameVi.trim().isNotEmpty) {
            _nameVi.text = parsed.nameVi;
          }
          _short.text = parsed.shortDetail;
          _shortVi.text = parsed.shortDetailVi;
          if (parsed.image.isNotEmpty) {
            _image = parsed.image;
          }
          _blocks
            ..clear()
            ..addAll(parsed.blocks.map((block) => EditorBlock.fromJson(block.toJson())));
          final nutrition = (post is Map ? post['nutrition'] : null);
          if (nutrition is Map) {
            _nutritionDescription.text = '${nutrition['description'] ?? ''}';
            final per = nutrition['per_100g'] is Map ? nutrition['per_100g'] as Map : nutrition;
            for (final entry in _nutrition.entries) {
              entry.value.text = per[entry.key] == null ? '' : '${per[entry.key]}';
            }
          }
        }
      }
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
        'type': _type,
        'short_detail': _short.text,
        'short_detail_vi': _shortVi.text,
        'profile_image': _image,
        'display_blocks': _blocks.map((block) => block.toJson()).toList(),
        'nutrition': {
          'description': _nutritionDescription.text,
          'per_100g': {
            for (final entry in _nutrition.entries)
              entry.key: double.tryParse(entry.value.text) ?? 0,
          },
        },
      };
      if (_creating) {
        final response = await state.api.postJson('/api/ingredient/profile/create_ingredient', payload);
        final id = response is Map ? '${response['ingredient_id'] ?? ''}' : '';
        if (id.isEmpty) {
          throw EditorException('save');
        }
        if (!mounted) {
          return;
        }
        Navigator.pushReplacementNamed(context, '/ingredient', arguments: {'ingredient_id': id});
      } else {
        final response = await state.api.postJson('/api/ingredient/profile/create_ingredient_post', {
          'ingredient_id': widget.ingredientId,
          'ingredient_name': name.isNotEmpty ? name : nameVi,
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
        Navigator.pushReplacementNamed(context, '/ingredient', arguments: {'ingredient_id': widget.ingredientId});
      }
    } on EditorException catch (error) {
      if (mounted) {
        setState(() => _error = error.serverMessage ?? state.t('common.errorBody'));
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

  Future<void> _translateField(TextEditingController from, TextEditingController to) async {
    if (!_autoTranslate || from.text.trim().isEmpty || to.text.trim().isNotEmpty) {
      return;
    }
    try {
      final value = await EditorApi(AppScope.of(context).api).translate(from.text.trim(), 'en', 'vi');
      if (mounted && to.text.trim().isEmpty) {
        setState(() => to.text = value);
      }
    } on EditorException {
      //Translation is optional; the typed text stays.
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _nameVi.dispose();
    _short.dispose();
    _shortVi.dispose();
    _nutritionDescription.dispose();
    for (final controller in _nutrition.values) {
      controller.dispose();
    }
    super.dispose();
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
          Text(_creating ? state.t('edit.createIngredientTitle') : state.t('edit.titleEditIngredient'),
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
                  Focus(
                    onFocusChange: (hasFocus) {
                      if (!hasFocus) {
                        _translateField(_name, _nameVi);
                      }
                    },
                    child: _field(state, _name, state.t('edit.nameEn'), 'ing-name'),
                  ),
                  const SizedBox(height: 10),
                  _field(state, _nameVi, state.t('edit.nameVi'), 'ing-name-vi'),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: _type,
                    decoration: InputDecoration(labelText: state.t('edit.type')),
                    items: [
                      for (final type in _types)
                        DropdownMenuItem(value: type, child: Text(state.t('ingredients.${type.toLowerCase()}'))),
                    ],
                    onChanged: (value) => setState(() => _type = value ?? 'Other'),
                  ),
                  const SizedBox(height: 10),
                  Focus(
                    onFocusChange: (hasFocus) {
                      if (!hasFocus) {
                        _translateField(_short, _shortVi);
                      }
                    },
                    child: _field(state, _short, state.t('edit.shortEn'), 'ing-short'),
                  ),
                  const SizedBox(height: 10),
                  _field(state, _shortVi, state.t('edit.shortVi'), 'ing-short-vi'),
                  const SizedBox(height: 14),
                  Text(state.t('edit.image').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
                  const SizedBox(height: 6),
                  EditorImageField(
                    api: EditorApi(state.api),
                    label: state.t('edit.dropCover'),
                    value: _image,
                    pickImage: widget.pickImage,
                    onChanged: (path) {
                      if (!mounted) {
                        return;
                      }
                      setState(() => _image = path);
                    },
                    onError: _handleImageError,
                  ),
                  const SizedBox(height: 14),
                  Text('${state.t('edit.nutrition')} (100 g)'.toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
                  const SizedBox(height: 6),
                  TextField(
                    key: const ValueKey('ing-nutrition-description'),
                    controller: _nutritionDescription,
                    style: TextStyle(fontSize: 13, color: tokens.ink),
                    decoration: const InputDecoration(labelText: 'USDA description'),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final entry in _nutrition.entries)
                        SizedBox(
                          width: 140,
                          child: TextField(
                            key: ValueKey('ing-nutrition-${entry.key}'),
                            controller: entry.value,
                            keyboardType: TextInputType.number,
                            style: TextStyle(fontSize: 13, color: tokens.ink),
                            decoration: InputDecoration(labelText: entry.key),
                          ),
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
                    translate: (text, source, target) => EditorApi(state.api).translate(text, source, target),
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
                  key: const ValueKey('ingredient-save'),
                  label: _busy
                      ? state.t('common.loading')
                      : (_creating ? state.t('edit.createAction') : state.t('common.save')),
                  primary: true,
                  onPressed: _busy ? null : _save,
                ),
                const SizedBox(width: 8),
                BoardButton(
                  label: state.t('common.cancel'),
                  onPressed: () {
                    if (Navigator.canPop(context)) {
                      Navigator.pop(context);
                    } else {
                      Navigator.pushReplacementNamed(context, '/ingredients');
                    }
                  },
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _field(AppState state, TextEditingController controller, String label, String name) {
    final tokens = BoardTokens.of(state.isLight);
    return TextField(
      key: ValueKey(name),
      controller: controller,
      style: TextStyle(fontSize: 13, color: tokens.ink),
      decoration: InputDecoration(labelText: label),
    );
  }
}
