import 'dart:typed_data';

import 'package:collection/collection.dart';
import 'package:desktop_drop/desktop_drop.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';
import 'editor_api.dart';

///Pick, drop, upload and preview one image.
class EditorImageField extends StatefulWidget {
  const EditorImageField({
    super.key,
    required this.api,
    required this.label,
    this.value = '',
    required this.onChanged,
    this.onError,
    this.pickImage,
    this.imageName = 'image.png',
    this.height = 120,
  });

  final EditorApi api;
  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final ValueChanged<String>? onError;
  final Future<Uint8List?> Function()? pickImage;
  final String imageName;
  final double height;

  @override
  State<EditorImageField> createState() => _EditorImageFieldState();
}

class _EditorImageFieldState extends State<EditorImageField> {
  bool _busy = false;
  bool _dragging = false;

  Future<Uint8List?> _pick() async {
    if (widget.pickImage != null) {
      return widget.pickImage!();
    }
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['png', 'jpg', 'jpeg'],
      withData: true,
    );
    return result?.files.firstOrNull?.bytes;
  }

  Future<void> _upload(Uint8List? bytes, {String? name}) async {
    if (bytes == null || bytes.isEmpty) {
      return;
    }
    setState(() => _busy = true);
    try {
      final path = await widget.api.upload(bytes, name ?? widget.imageName);
      if (mounted) {
        widget.onChanged(path);
      }
    } on EditorException catch (error) {
      widget.onError?.call(error.kind);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return DropTarget(
      onDragEntered: (_) => setState(() => _dragging = true),
      onDragExited: (_) => setState(() => _dragging = false),
      onDragDone: (details) async {
        setState(() => _dragging = false);
        final item = details.files.firstOrNull;
        if (item == null) {
          return;
        }
        await _upload(await item.readAsBytes(), name: item.name);
      },
      child: InkWell(
        key: const ValueKey('image-pick'),
        onTap: _busy
            ? null
            : () async {
                await _upload(await _pick());
              },
        child: Container(
          height: widget.height,
          decoration: BoxDecoration(
            border: Border.all(color: _dragging ? tokens.amber : tokens.lineStrong),
            borderRadius: BorderRadius.circular(BoardTokens.radius),
          ),
          child: Row(
            children: [
              if (widget.value.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: BoardImage(url: state.api.imageUrl(widget.value), width: 84, height: 84),
                ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Text(
                    _busy ? state.t('common.loading') : widget.label,
                    style: TextStyle(fontSize: 13, color: tokens.dim),
                  ),
                ),
              ),
              if (widget.value.isNotEmpty)
                IconButton(
                  key: const ValueKey('image-clear'),
                  icon: Icon(Icons.close, size: 16, color: tokens.dim),
                  onPressed: () => widget.onChanged(''),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
