import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';
import 'editor_api.dart';
import 'editor_image_field.dart';

///One editable block; serialises to the shape the Vue editor writes.
class EditorBlock {
  EditorBlock({
    this.type = 'text',
    this.text = '',
    this.textVi = '',
    this.src = '',
    this.fontSize = 14,
    this.color = 'black',
    this.fontWeight = 'normal',
    this.fontStyle = 'normal',
    this.textAlign = 'left',
  });

  EditorBlock.text() : this(type: 'text');

  EditorBlock.image(String source) : this(type: 'image', src: source);

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
    return {
      'type': type,
      'text': text,
      'text_vi': textVi,
      'font_size': fontSize,
      'color': color,
      'font_weight': fontWeight,
      'font_style': fontStyle,
      'text_align': textAlign,
    };
  }

  EditorBlock copy() => EditorBlock.fromJson(toJson())..src = src;
}

class BlocksEditor extends StatelessWidget {
  const BlocksEditor({
    super.key,
    required this.blocks,
    required this.onChanged,
    required this.pickImage,
    this.imageName = 'block.png',
    this.onImageError,
  });

  final List<EditorBlock> blocks;
  final ValueChanged<List<EditorBlock>> onChanged;
  final Future<Uint8List?> Function()? pickImage;
  final String imageName;
  final ValueChanged<String>? onImageError;

  void _update(int index, void Function(EditorBlock block) change) {
    final next = blocks.map((block) => block.copy()).toList();
    change(next[index]);
    onChanged(next);
  }

  void _move(int index, int delta) {
    final target = index + delta;
    if (target < 0 || target >= blocks.length) {
      return;
    }
    final next = blocks.map((block) => block.copy()).toList();
    final block = next.removeAt(index);
    next.insert(target, block);
    onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var index = 0; index < blocks.length; index++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: BoardCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (blocks[index].type == 'text') _textToolbar(state, tokens, index),
                  if (blocks[index].type == 'text') ...[
                    const SizedBox(height: 8),
                    TextField(
                      key: ValueKey('block-text-en-$index'),
                      controller: TextEditingController(text: blocks[index].text),
                      onChanged: (value) => _update(index, (block) => block.text = value),
                      style: TextStyle(fontSize: 13, color: tokens.ink),
                      decoration: InputDecoration(labelText: state.t('edit.blockTextEn')),
                      maxLines: 3,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      key: ValueKey('block-text-vi-$index'),
                      controller: TextEditingController(text: blocks[index].textVi),
                      onChanged: (value) => _update(index, (block) => block.textVi = value),
                      style: TextStyle(fontSize: 13, color: tokens.ink),
                      decoration: InputDecoration(labelText: state.t('edit.blockTextVi')),
                      maxLines: 3,
                    ),
                  ] else ...[
                    EditorImageField(
                      api: EditorApi(state.api),
                      key: ValueKey('block-image-$index'),
                      label: state.t('edit.dropCover'),
                      value: blocks[index].src,
                      pickImage: pickImage,
                      imageName: imageName,
                      onError: onImageError,
                      onChanged: (path) => _update(index, (block) => block.src = path),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      key: ValueKey('block-caption-en-$index'),
                      controller: TextEditingController(text: blocks[index].text),
                      onChanged: (value) => _update(index, (block) => block.text = value),
                      style: TextStyle(fontSize: 13, color: tokens.ink),
                      decoration: InputDecoration(labelText: state.t('edit.imageCaptionEn')),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _iconButton(Icons.arrow_upward, state.t('edit.moveUp'), index == 0, () => _move(index, -1),
                          key: ValueKey('block-move-up-$index')),
                      const SizedBox(width: 4),
                      _iconButton(Icons.arrow_downward, state.t('edit.moveDown'), index == blocks.length - 1,
                          () => _move(index, 1),
                          key: ValueKey('block-move-down-$index')),
                      const SizedBox(width: 4),
                      _iconButton(Icons.close, state.t('edit.removeBlock'), false, () {
                        final next = blocks.where((block) => block != blocks[index]).map((block) => block.copy()).toList();
                        onChanged(next);
                      }, key: ValueKey('block-delete-$index')),
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
              onPressed: () => onChanged([...blocks, EditorBlock.text()]),
            ),
            BoardButton(
              key: const ValueKey('add-image'),
              label: state.t('edit.addImage'),
              onPressed: () => _addImage(state),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _addImage(AppState state) async {
    final bytes = await pickImage?.call();
    if (bytes == null || bytes.isEmpty) {
      onChanged([...blocks, EditorBlock.image('')]);
      return;
    }
    try {
      final path = await EditorApi(state.api).upload(bytes, imageName);
      onChanged([...blocks, EditorBlock.image(path)]);
    } on EditorException catch (error) {
      onImageError?.call(error.kind);
      onChanged([...blocks, EditorBlock.image('')]);
    }
  }

  Widget _textToolbar(AppState state, BoardTokens tokens, int index) {
    final block = blocks[index];
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _toggle(tokens, Icons.format_bold, block.bold, ValueKey('block-bold-$index'), state.t('edit.bold'), () {
          _update(index, (item) => item.fontWeight = item.bold ? 'normal' : 'bold');
        }),
        _toggle(tokens, Icons.format_italic, block.italic, ValueKey('block-italic-$index'), state.t('edit.italic'), () {
          _update(index, (item) => item.fontStyle = item.italic ? 'normal' : 'italic');
        }),
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
          value: block.color,
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
        _toggle(tokens, Icons.format_align_left, block.textAlign == 'left', ValueKey('block-align-left-$index'),
            state.t('edit.alignLeft'), () => _update(index, (item) => item.textAlign = 'left')),
        _toggle(tokens, Icons.format_align_center, block.textAlign == 'center', ValueKey('block-align-center-$index'),
            state.t('edit.alignCenter'), () => _update(index, (item) => item.textAlign = 'center')),
      ],
    );
  }

  Widget _toggle(BoardTokens tokens, IconData icon, bool active, Key key, String tooltip, VoidCallback onTap) {
    return Tooltip(
      message: tooltip,
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
    );
  }

  Widget _iconButton(IconData icon, String tooltip, bool disabled, VoidCallback onTap, {required Key key}) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        key: key,
        onTap: disabled ? null : onTap,
        child: Container(
          width: 28,
          height: 26,
          decoration: BoxDecoration(border: Border.all(color: const Color(0xFF3A434F)), borderRadius: BorderRadius.circular(4)),
          child: Icon(icon, size: 14, color: disabled ? const Color(0xFF5B6470) : const Color(0xFFF2F0EA)),
        ),
      ),
    );
  }
}
