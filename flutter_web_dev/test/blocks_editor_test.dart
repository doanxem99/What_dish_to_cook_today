//The block editor writes the same JSON shape the Vue editor does.
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/editor/blocks_editor.dart';
import 'package:what_dish_to_cook_today/editor/editor_image_field.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';

const _catalogue = {
  'edit.addText': 'Add text block',
  'edit.addImage': 'Add image block',
  'edit.bold': 'Bold',
  'edit.italic': 'Italic',
  'edit.textSize': 'Text size',
  'edit.textColor': 'Text colour',
  'edit.alignLeft': 'Align left',
  'edit.alignCenter': 'Align centre',
  'edit.blockTextEn': 'Text (English)',
  'edit.blockTextVi': 'Text (Vietnamese)',
  'edit.imageCaptionEn': 'Caption (English)',
  'edit.imageCaptionVi': 'Caption (Vietnamese)',
  'edit.moveUp': 'Move up',
  'edit.moveDown': 'Move down',
  'edit.removeBlock': 'Remove block',
  'edit.dropCover': 'Choose an image',
  'common.loading': 'Loading',
  'common.delete': 'Delete',
};

ApiClient _uploadApi(List<String> calls) {
  return ApiClient('http://test', client: MockClient((request) async {
    calls.add('${request.method} ${request.url.path}');
    return http.Response('{"isSuccess":true,"path":"public/gallery/temporary/a.png"}', 200,
        headers: {'content-type': 'application/json; charset=utf-8'});
  }));
}

Widget _harness(ApiClient api, List<EditorBlock> blocks, void Function(List<EditorBlock>) onChanged) {
  final state = AppState(catalogues: {'en': I18n(_catalogue), 'vi': I18n(const {})}, api: api);
  return AppScope(
    state: state,
    child: MaterialApp(
      theme: boardTheme(BoardTokens.dark),
      home: Scaffold(
        body: StatefulBuilder(builder: (context, setState) {
          return SingleChildScrollView(
            child: BlocksEditor(
              blocks: blocks,
              onChanged: (next) {
                onChanged(next);
                setState(() => blocks = next);
              },
              pickImage: () async => PickedImage(Uint8List.fromList([1, 2, 3]), 'block.png'),
              imageName: 'block.png',
            ),
          );
        },),
      ),
    ),
  );
}

void main() {
  testWidgets('adds a text block and edits both languages', (tester) async {
    tester.view.physicalSize = const Size(900, 1200);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    var blocks = <EditorBlock>[];

    await tester.pumpWidget(_harness(_uploadApi(calls), blocks, (next) => blocks = next));
    await tester.tap(find.text('Add text block'));
    await tester.pumpAndSettle();

    expect(blocks.length, 1);
    expect(blocks.first.type, 'text');

    await tester.enterText(find.byKey(const ValueKey('block-text-en-0')), 'Serve hot');
    await tester.enterText(find.byKey(const ValueKey('block-text-vi-0')), 'Dùng nóng');
    await tester.pump();

    expect(blocks.first.text, 'Serve hot');
    expect(blocks.first.textVi, 'Dùng nóng');
  });

  testWidgets('formatting, reordering and deleting work', (tester) async {
    tester.view.physicalSize = const Size(900, 1400);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    var blocks = <EditorBlock>[];

    await tester.pumpWidget(_harness(_uploadApi(calls), blocks, (next) => blocks = next));
    await tester.tap(find.text('Add text block'));
    await tester.pump();
    await tester.tap(find.text('Add text block'));
    await tester.pumpAndSettle();
    expect(blocks.length, 2);

    await tester.tap(find.byKey(const ValueKey('block-bold-0')));
    await tester.pump();
    expect(blocks.first.fontWeight, 'bold');

    await tester.tap(find.byKey(const ValueKey('block-move-down-0')));
    await tester.pump();
    expect(blocks.first.fontWeight, 'normal');

    await tester.tap(find.byKey(const ValueKey('block-delete-1')));
    await tester.pump();
    expect(blocks.length, 1);
  });

  testWidgets('an image block uploads and stores the returned path', (tester) async {
    tester.view.physicalSize = const Size(900, 1200);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    var blocks = <EditorBlock>[];

    await tester.pumpWidget(_harness(_uploadApi(calls), blocks, (next) => blocks = next));
    await tester.tap(find.text('Add image block'));
    await tester.pumpAndSettle();

    expect(calls, contains('POST /api/gallery_upload/temporary'));
    expect(blocks.length, 1);
    expect(blocks.first.type, 'image');
    expect(blocks.first.src, 'public/gallery/temporary/a.png');
  });

  test('blocks serialise to the Vue JSON shape', () {
    final block = EditorBlock.text()
      ..text = 'Serve hot'
      ..fontWeight = 'bold'
      ..textAlign = 'center';

    expect(block.toJson(), {
      'type': 'text',
      'text': 'Serve hot',
      'text_vi': '',
      'font_size': 14.0,
      'color': 'black',
      'font_weight': 'bold',
      'font_style': 'normal',
      'text_align': 'center',
    });
  });
  test('image blocks serialise with their source and no text-only keys', () {
    final json = EditorBlock.image('public/gallery/a.png').toJson();

    expect(json['type'], 'image');
    expect(json['src'], 'public/gallery/a.png');
    expect(json.containsKey('font_weight'), isFalse);
    expect(json.containsKey('text_align'), isFalse);
  });

  testWidgets('image captions can be entered in both languages', (tester) async {
    tester.view.physicalSize = const Size(900, 1400);
    tester.view.devicePixelRatio = 1;
    var blocks = <EditorBlock>[];

    await tester.pumpWidget(_harness(_uploadApi(<String>[]), blocks, (next) => blocks = next));
    await tester.tap(find.text('Add image block'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const ValueKey('block-caption-en-0')), 'Served hot');
    await tester.enterText(find.byKey(const ValueKey('block-caption-vi-0')), 'Dùng nóng');
    await tester.pump();

    expect(blocks.first.text, 'Served hot');
    expect(blocks.first.textVi, 'Dùng nóng');
  });
}