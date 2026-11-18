import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';
import 'editor_api.dart';
import 'editor_image_field.dart';

var _blockCounter = 0;

///One editable block; serialises to the shape the Vue editor writes.
class EditorBlock {
  EditorBlock({
    String? id,
    this.type = 'text',
    this.text = '',
    this.textVi = '',
    this.src = '',
    this.fontSize = 14,
    this.color = 'black',
    this.fontWeight = 'normal',
    this.fontStyle = 'normal',
    this.textAlign = 'left',
  }) : id = id ?? 'b${_blockCounter++}';

  EditorBlock.text() : this(type: 'text');

  EditorBlock.image(String source) : this(type: 'image', src: source);

  final String id;
  String type;
  String text;
  String textVi;
  String src;
  double fontSize;
  String color;
  String fontWeight;
  String fontStyle;
  String textAlign;

  bool get bold => fontWeight == 'bold';
  bool get italic => fontStyle == 'italic';
  bool get isImage => type == 'image';

  factory EditorBlock.fromJson(Map<String, dynamic> json) {
    double size = 14;
    final raw = json['font_size'];
    if (raw is num) {
      size = raw.toDouble();
    }
    return EditorBlock(
      type: '${json['type'] ?? 'text'}',
      text: '${json['text'] ?? ''}',
      textVi: '${json['text_vi'] ?? ''}',
      src: '${json['src'] ?? ''}',
      fontSize: size,
      color: '${json['color'] ?? 'black'}',
      fontWeight: '${json['font_weight'] ?? 'normal'}',
      fontStyle: '${json['font_style'] ?? 'normal'}',
      textAlign: '${json['text_align'] ?? 'left'}',
    );
  }

  Map<String, dynamic> toJson() {
    if (isImage) {
      //Vue keeps only these keys on an image block.
      return {
        'type': 'image',
        'src': src,
        'text': text,
        'text_vi': textVi,
        'font_size': fontSize,
        'color': color,
      };
    }
    return {
      'type': 'text',
      'text': text,
      'text_vi': textVi,
      'font_size': fontSize,
      'color': color,
      'font_weight': fontWeight,
      'font_style': fontStyle,
      'text_align': textAlign,
    };
  }

  EditorBlock copy() {
    return EditorBlock(
      id: id,
      type: type,
      text: text,
      textVi: textVi,
      src: src,
      fontSize: fontSize,
      color: color,
      fontWeight: fontWeight,
      fontStyle: fontStyle,
      textAlign: textAlign,
    );
  }
}

class BlocksEditor extends StatefulWidget {
  const BlocksEditor({
    super.key,
    required this.blocks,
    required this.onChanged,
    this.pickImage,
    this.imageName = 'block.png',
    this.onImageError,
    this.autoTranslate = false,
    this.translate,
  });

  final List<EditorBlock> blocks;
  final ValueChanged<List<EditorBlock>> onChanged;
  final Future<PickedImage?> Function()? pickImage;
  final String imageName;
  final ValueChanged<String>? onImageError;
  final bool autoTranslate;
  final Future<String> Function(String text, String source, String target)? translate;

  @override
  State<BlocksEditor> createState() => _BlocksEditorState();
}

class _BlocksEditorState extends State<BlocksEditor> {
  String? _imageError;

  List<EditorBlock> get _blocks => widget.blocks;

  void _update(int index, void Function(EditorBlock block) change) {
    final next = _blocks.map((block) => block.copy()).toList();
    change(next[index]);
    widget.onChanged(next);
  }

  void _move(int index, int delta) {
    final target = index + delta;
    if (target < 0 || target >= _blocks.length) {
      return;
    }
    final next = _blocks.map((block) => block.copy()).toList();
    final block = next.removeAt(index);
    next.insert(target, block);
    widget.onChanged(next);
  }

  void _delete(int index) {
    final next = _blocks.map((block) => block.copy()).toList()..removeAt(index);
    widget.onChanged(next);
  }

  Future<void> _translateField(int index, String fromKey) async {
    final translate = widget.translate;
    if (!widget.autoTranslate || translate == null || index >= _blocks.length) {
      return;
    }
    final block = _blocks[index];
    final text = (fromKey == 'text' ? block.text : block.textVi).trim();
    final existing = (fromKey == 'text' ? block.textVi : block.text).trim();
    if (text.isEmpty || existing.isNotEmpty) {
      return;
    }
    final id = block.id;
    try {
      final value = await translate(text, fromKey == 'text' ? 'en' : 'vi', fromKey == 'text' ? 'vi' : 'en');
      var currentIndex = -1;
      for (var i = 0; i < _blocks.length; i++) {
        if (_blocks[i].id == id) {
          currentIndex = i;
          break;
        }
      }
      if (!mounted || currentIndex < 0) {
        return;
      }
      final current = _blocks[currentIndex];
      final sourceNow = (fromKey == 'text' ? current.text : current.textVi).trim();
      final targetNow = (fromKey == 'text' ? current.textVi : current.text).trim();
      if (sourceNow != text || targetNow.isNotEmpty) {
        return;
      }
      _update(currentIndex, (item) {
        if (fromKey == 'text') {
          item.textVi = value;
        } else {
          item.text = value;
        }
      });
    } catch (_) {
      //The source text stays usable; translation is optional.
    }
  }

  Future<void> _addImage(AppState state) async {
    final picker = widget.pickImage;
    if (picker == null) {
      return;
    }
    PickedImage? picked;
    try {
      picked = await picker();
    } catch (_) {
      picked = null;
    }
    if (picked == null || picked.bytes.isEmpty) {
      return;
    }
    try {
      final path = await EditorApi(state.api).upload(picked.bytes, picked.name.isEmpty ? widget.imageName : picked.name);
      //Read the current list after the await so edits made meanwhile survive.
      widget.onChanged([...widget.blocks, EditorBlock.image(path)]);
      if (mounted) {
        setState(() => _imageError = null);
      }
    } on EditorException {
      widget.onImageError?.call('upload');
      if (mounted) {
        setState(() => _imageError = state.t('common.errorBody'));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var index = 0; index < _blocks.length; index++)
          Padding(
            key: ValueKey(_blocks[index].id),
            padding: const EdgeInsets.only(bottom: 12),
            child: BoardCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!_blocks[index].isImage)
                    _textToolbar(state, tokens, index)
                  else
                    _imageBlock(state, index),
                  if (!_blocks[index].isImage) _textFields(state, tokens, index),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _iconButton(tokens, Icons.arrow_upward, state.t('edit.moveUp'), index == 0,
                          () => _move(index, -1),
                          key: ValueKey('block-move-up-$index')),
                      const SizedBox(width: 4),
                      _iconButton(tokens, Icons.arrow_downward, state.t('edit.moveDown'), index == _blocks.length - 1,
                          () => _move(index, 1),
                          key: ValueKey('block-move-down-$index')),
                      const SizedBox(width: 4),
                      _iconButton(tokens, Icons.close, state.t('edit.removeBlock'), false, () => _delete(index),
                          key: ValueKey('block-delete-$index')),
                    ],
                  ),
                ],
              ),
            ),
          ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            BoardButton(
              key: const ValueKey('add-text'),
              label: state.t('edit.addText'),
              onPressed: () => widget.onChanged([..._blocks, EditorBlock.text()]),
            ),
            BoardButton(
              key: const ValueKey('add-image'),
              label: state.t('edit.addImage'),
              onPressed: () => _addImage(state),
            ),
          ],
        ),
        if (_imageError != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_imageError!, style: TextStyle(fontSize: 13, color: tokens.danger)),
          ),
      ],
    );
  }

  Widget _imageBlock(AppState state, int index) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        EditorImageField(
          api: EditorApi(state.api),
          key: ValueKey('block-image-$index'),
          label: state.t('edit.dropCover'),
          value: _blocks[index].src,
          pickImage: widget.pickImage,
          imageName: widget.imageName,
          onError: (_) => setState(() => _imageError = state.t('common.errorBody')),
          onChanged: (path) => _update(index, (block) => block.src = path),
        ),
        const SizedBox(height: 8),
        _BlockTextField(
          key: ValueKey('caption-${_blocks[index].id}'),
          fieldKey: ValueKey('block-caption-en-$index'),
          label: state.t('edit.imageCaptionEn'),
          value: _blocks[index].text,
          onChanged: (value) => _update(index, (block) => block.text = value),
        ),
        const SizedBox(height: 8),
        _BlockTextField(
          key: ValueKey('caption-vi-${_blocks[index].id}'),
          fieldKey: ValueKey('block-caption-vi-$index'),
          label: state.t('edit.imageCaptionVi'),
          value: _blocks[index].textVi,
          onChanged: (value) => _update(index, (block) => block.textVi = value),
        ),
      ],
    );
  }

  Widget _textFields(AppState state, BoardTokens tokens, int index) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        children: [
          _BlockTextField(
            key: ValueKey('text-en-${_blocks[index].id}'),
            fieldKey: ValueKey('block-text-en-$index'),
            label: state.t('edit.blockTextEn'),
            value: _blocks[index].text,
            onChanged: (value) => _update(index, (block) => block.text = value),
            onBlur: () => _translateField(index, 'text'),
          ),
          const SizedBox(height: 8),
          _BlockTextField(
            key: ValueKey('text-vi-${_blocks[index].id}'),
            fieldKey: ValueKey('block-text-vi-$index'),
            label: state.t('edit.blockTextVi'),
            value: _blocks[index].textVi,
            onChanged: (value) => _update(index, (block) => block.textVi = value),
            onBlur: () => _translateField(index, 'textVi'),
          ),
        ],
      ),
    );
  }

  Widget _textToolbar(AppState state, BoardTokens tokens, int index) {
    final block = _blocks[index];
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _toggle(tokens, Icons.format_bold, block.bold, state.t('edit.bold'), () {
          _update(index, (item) => item.fontWeight = item.bold ? 'normal' : 'bold');
        }, key: ValueKey('block-bold-$index')),
        _toggle(tokens, Icons.format_italic, block.italic, state.t('edit.italic'), () {
          _update(index, (item) => item.fontStyle = item.italic ? 'normal' : 'italic');
        }, key: ValueKey('block-italic-$index')),
        DropdownButton<double>(
          key: ValueKey('block-size-$index'),
          value: [12.0, 14.0, 18.0, 24.0].contains(block.fontSize) ? block.fontSize : 14,
          underline: const SizedBox.shrink(),
          style: TextStyle(fontSize: 12, color: tokens.ink),
          items: const [
            DropdownMenuItem(value: 12, child: Text('12')),
            DropdownMenuItem(value: 14, child: Text('14')),
            DropdownMenuItem(value: 18, child: Text('18')),
            DropdownMenuItem(value: 24, child: Text('24')),
          ],
          onChanged: (value) {
            if (value != null) {
              _update(index, (item) => item.fontSize = value);
            }
          },
        ),
        DropdownButton<String>(
          key: ValueKey('block-color-$index'),
          value: const ['black', 'white', 'red', 'blue', 'green'].contains(block.color) ? block.color : 'black',
          underline: const SizedBox.shrink(),
          style: TextStyle(fontSize: 12, color: tokens.ink),
          items: const [
            DropdownMenuItem(value: 'black', child: Text('Black')),
            DropdownMenuItem(value: 'white', child: Text('White')),
            DropdownMenuItem(value: 'red', child: Text('Red')),
            DropdownMenuItem(value: 'blue', child: Text('Blue')),
            DropdownMenuItem(value: 'green', child: Text('Green')),
          ],
          onChanged: (value) {
            if (value != null) {
              _update(index, (item) => item.color = value);
            }
          },
        ),
        _toggle(tokens, Icons.format_align_left, block.textAlign == 'left', state.t('edit.alignLeft'),
            () => _update(index, (item) => item.textAlign = 'left'), key: ValueKey('block-align-left-$index')),
        _toggle(tokens, Icons.format_align_center, block.textAlign == 'center', state.t('edit.alignCenter'),
            () => _update(index, (item) => item.textAlign = 'center'), key: ValueKey('block-align-center-$index')),
        _toggle(tokens, Icons.format_align_right, block.textAlign == 'right', state.t('edit.alignRight'),
            () => _update(index, (item) => item.textAlign = 'right'), key: ValueKey('block-align-right-$index')),
      ],
    );
  }

  Widget _toggle(BoardTokens tokens, IconData icon, bool active, String label, VoidCallback onTap,
      {required Key key}) {
    return Semantics(
      button: true,
      toggled: active,
      label: label,
      child: Tooltip(
        message: label,
        child: InkWell(
          key: key,
          onTap: onTap,
          child: Container(
            width: 28,
            height: 26,
            decoration: BoxDecoration(
              border: Border.all(color: active ? tokens.amber : tokens.line),
              borderRadius: BorderRadius.circular(BoardTokens.radius),
            ),
            child: Icon(icon, size: 14, color: active ? tokens.amber : tokens.dim),
          ),
        ),
      ),
    );
  }

  Widget _iconButton(BoardTokens tokens, IconData icon, String label, bool disabled, VoidCallback onTap,
      {required Key key}) {
    return Semantics(
      button: true,
      enabled: !disabled,
      label: label,
      child: Tooltip(
        message: label,
        child: InkWell(
          key: key,
          onTap: disabled ? null : onTap,
          child: Container(
            width: 28,
            height: 26,
            decoration: BoxDecoration(
              border: Border.all(color: tokens.line),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Icon(icon, size: 14, color: disabled ? tokens.lineStrong : tokens.ink),
          ),
        ),
      ),
    );
  }
}

///Keeps its own controller so typing never rebuilds the whole block.
class _BlockTextField extends StatefulWidget {
  const _BlockTextField(
      {super.key, required this.fieldKey, required this.label, required this.value, required this.onChanged, this.onBlur});

  final Key fieldKey;
  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final VoidCallback? onBlur;

  @override
  State<_BlockTextField> createState() => _BlockTextFieldState();
}

class _BlockTextFieldState extends State<_BlockTextField> {
  late final TextEditingController _controller;
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
    _focus.addListener(() {
      if (!_focus.hasFocus) {
        widget.onBlur?.call();
      }
    });
  }

  @override
  void didUpdateWidget(covariant _BlockTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    //External writes (translation) only land when the user is not typing here.
    if (!_focus.hasFocus && widget.value != _controller.text) {
      _controller.text = widget.value;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BoardTokens.of(AppScope.of(context).isLight);
    return TextField(
      key: widget.fieldKey,
      controller: _controller,
      focusNode: _focus,
      onChanged: widget.onChanged,
      maxLines: 3,
      style: TextStyle(fontSize: 13, color: tokens.ink),
      decoration: InputDecoration(labelText: widget.label),
    );
  }
}

