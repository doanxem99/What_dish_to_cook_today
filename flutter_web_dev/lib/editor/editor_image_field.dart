import 'dart:typed_data';

import 'package:collection/collection.dart';
import 'package:desktop_drop/desktop_drop.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';
import 'editor_api.dart';

class PickedImage {
  const PickedImage(this.bytes, this.name);

  final Uint8List bytes;
  final String name;
}

typedef ImagePicker = Future<PickedImage?> Function();

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
  final ImagePicker? pickImage;
  final String imageName;
  final double height;

  @override
  State<EditorImageField> createState() => _EditorImageFieldState();
}

class _EditorImageFieldState extends State<EditorImageField> {
  bool _busy = false;
  bool _dragging = false;

  bool _allowed(String name) {
    final lower = name.toLowerCase();
    return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
  }

  Future<PickedImage?> _pick() async {
    if (widget.pickImage != null) {
      return widget.pickImage!();
    }
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['png', 'jpg', 'jpeg'],
      withReadStream: true,
    );
    final file = result?.files.firstOrNull;
    if (file == null) {
      return null;
    }
    if (file.size > EditorApi.maxBytes || !_allowed(file.name)) {
      throw EditorException(file.size > EditorApi.maxBytes ? 'too-large' : 'type');
    }
    final bytes = file.bytes ?? await _readStream(file.readStream);
    if (bytes == null) {
      return null;
    }
    return PickedImage(bytes, file.name);
  }

  Future<Uint8List?> _readStream(Stream<List<int>>? stream) async {
    if (stream == null) {
      return null;
    }
    final builder = BytesBuilder(copy: false);
    await for (final chunk in stream) {
      builder.add(chunk);
    }
    return builder.takeBytes();
  }

  Future<void> _upload(PickedImage? picked) async {
    if (picked == null || picked.bytes.isEmpty || _busy) {
      return;
    }
    setState(() => _busy = true);
    try {
      final path = await widget.api.upload(picked.bytes, picked.name.isEmpty ? widget.imageName : picked.name);
      if (mounted) {
        widget.onChanged(path);
      }
    } on EditorException catch (error) {
      widget.onError?.call(error.kind);
    } catch (_) {
      widget.onError?.call('upload');
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _handleTap() async {
    if (_busy) {
      return;
    }
    try {
      await _upload(await _pick());
    } catch (error) {
      widget.onError?.call(error is EditorException ? error.kind : 'upload');
    }
  }

  Future<void> _handleDrop(DropDoneDetails details) async {
    setState(() => _dragging = false);
    if (_busy) {
      return;
    }
    for (final item in details.files) {
      if (!_allowed(item.name)) {
        widget.onError?.call('type');
        continue;
      }
      try {
        if (await item.length() > EditorApi.maxBytes) {
          widget.onError?.call('too-large');
          continue;
        }
        await _upload(PickedImage(await item.readAsBytes(), item.name));
        return;
      } catch (_) {
        widget.onError?.call('upload');
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
      onDragDone: _handleDrop,
      child: InkWell(
        key: const ValueKey('image-pick'),
        onTap: _busy ? null : _handleTap,
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
