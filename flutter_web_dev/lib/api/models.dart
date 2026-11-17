import '../i18n/i18n.dart';
import '../state/app_state.dart';

String _text(dynamic value) => value == null ? '' : value.toString();

int _number(dynamic value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(_text(value)) ?? 0;
}

class IngredientRef {
  const IngredientRef({
    required this.id,
    required this.name,
    this.nameVi = '',
    this.type = 'Other',
    this.image = '',
  });

  final String id;
  final String name;
  final String nameVi;
  final String type;
  final String image;

  factory IngredientRef.fromJson(dynamic json) {
    if (json is! Map) {
      return const IngredientRef(id: '', name: '');
    }
    return IngredientRef(
      id: _text(json['id'] ?? json['_id']),
      name: _text(json['name']),
      nameVi: _text(json['name_vi']),
      type: _text(json['type']).isEmpty ? 'Other' : _text(json['type']),
      image: _text(json['profile_image']),
    );
  }

  String label(String locale) => I18n.label(nameVi, name, locale);

  BasketItem toBasketItem() => BasketItem(id: id, name: name, nameVi: nameVi);

  static List<IngredientRef> listFromJson(dynamic json) {
    if (json is! List) {
      return [];
    }
    return json.whereType<Map>().map(IngredientRef.fromJson).where((item) => item.id.isNotEmpty).toList();
  }
}

class DishPreview {
  const DishPreview({
    required this.id,
    required this.name,
    this.nameVi = '',
    this.shortDetail = '',
    this.shortDetailVi = '',
    this.image = '',
    this.matchCount = 0,
    this.totalIngredients = 0,
    this.ingredientDetails = const [],
  });

  final String id;
  final String name;
  final String nameVi;
  final String shortDetail;
  final String shortDetailVi;
  final String image;
  final int matchCount;
  final int totalIngredients;
  final List<IngredientRef> ingredientDetails;

  factory DishPreview.fromJson(dynamic json) {
    if (json is! Map) {
      return const DishPreview(id: '', name: '');
    }
    return DishPreview(
      id: _text(json['id'] ?? json['_id']),
      name: _text(json['name']),
      nameVi: _text(json['name_vi']),
      shortDetail: _text(json['short_detail']),
      shortDetailVi: _text(json['short_detail_vi']),
      image: _text(json['profile_image']),
      matchCount: _number(json['match_count']),
      totalIngredients: _number(json['total_ingredients']),
      ingredientDetails: IngredientRef.listFromJson(json['ingredients_detail'] ?? json['missing']),
    );
  }

  String label(String locale) => I18n.label(nameVi, name, locale);

  String detail(String locale) => I18n.label(shortDetailVi, shortDetail, locale);

  String ingredientLine(String locale) => ingredientDetails.map((item) => item.label(locale)).join(' · ');

  static List<DishPreview> listFromJson(dynamic json) {
    if (json is! List) {
      return [];
    }
    return json.whereType<Map>().map(DishPreview.fromJson).where((item) => item.id.isNotEmpty).toList();
  }
}

class DisplayBlock {
  const DisplayBlock({
    required this.type,
    this.text = '',
    this.textVi = '',
    this.src = '',
    this.fontSize = 14,
    this.color = 'black',
    this.fontWeight = 'normal',
    this.fontStyle = 'normal',
    this.textAlign = 'left',
  });

  final String type;
  final String text;
  final String textVi;
  final String src;
  final double fontSize;
  final String color;
  final String fontWeight;
  final String fontStyle;
  final String textAlign;

  bool get bold => fontWeight == 'bold';
  bool get italic => fontStyle == 'italic';
  String get align => textAlign;

  String label(String locale) => I18n.label(textVi, text, locale);

  static List<DisplayBlock> listFromJson(dynamic json) {
    if (json is! List) {
      return [];
    }
    final blocks = <DisplayBlock>[];
    for (final element in json.whereType<Map>()) {
      final type = _text(element['type']);
      if (type != 'text' && type != 'image') {
        continue;
      }
      if (type == 'image' && _text(element['src']).isEmpty) {
        continue;
      }
      blocks.add(DisplayBlock(
        type: type,
        text: _text(element['text']),
        textVi: _text(element['text_vi']),
        src: _text(element['src']),
        fontSize: _number(element['font_size']) == 0 ? 14 : _number(element['font_size']).toDouble(),
        color: _text(element['color']).isEmpty ? 'black' : _text(element['color']),
        fontWeight: _text(element['font_weight']).isEmpty ? 'normal' : _text(element['font_weight']),
        fontStyle: _text(element['font_style']).isEmpty ? 'normal' : _text(element['font_style']),
        textAlign: _text(element['text_align']).isEmpty ? 'left' : _text(element['text_align']),
      ));
    }
    return blocks;
  }
}

class DishPost {
  const DishPost({
    required this.id,
    required this.dishId,
    required this.name,
    this.nameVi = '',
    this.shortDetail = '',
    this.shortDetailVi = '',
    this.image = '',
    this.extraImages = const [],
    this.blocks = const [],
    this.ingredientIds = const [],
  });

  final String id;
  final String dishId;
  final String name;
  final String nameVi;
  final String shortDetail;
  final String shortDetailVi;
  final String image;
  final List<String> extraImages;
  final List<DisplayBlock> blocks;
  final List<String> ingredientIds;

  factory DishPost.fromJson(dynamic json, {String fallbackName = ''}) {
    if (json is! Map) {
      return DishPost(id: '', dishId: '', name: fallbackName);
    }
    final images = json['images'];
    final ingredientIds = json['ingredients'];
    return DishPost(
      id: _text(json['_id'] ?? json['id']),
      dishId: _text(json['dish_id']),
      name: _text(json['name']).isEmpty ? fallbackName : _text(json['name']),
      nameVi: _text(json['name_vi']),
      shortDetail: _text(json['short_detail']),
      shortDetailVi: _text(json['short_detail_vi']),
      image: _text(json['profile_image']),
      extraImages: images is List ? images.map(_text).where((item) => item.isNotEmpty).toList() : [],
      blocks: DisplayBlock.listFromJson(json['display_blocks']),
      ingredientIds: ingredientIds is List ? ingredientIds.map(_text).where((item) => item.isNotEmpty).toList() : [],
    );
  }

  String label(String locale) => I18n.label(nameVi, name, locale);

  String detail(String locale) => I18n.label(shortDetailVi, shortDetail, locale);
}

class DishSummary {
  const DishSummary({required this.id, required this.name, this.nameVi = '', this.bestPostId = ''});

  final String id;
  final String name;
  final String nameVi;
  final String bestPostId;

  factory DishSummary.fromJson(dynamic json) {
    if (json is! Map) {
      return const DishSummary(id: '', name: '');
    }
    return DishSummary(
      id: _text(json['_id'] ?? json['id']),
      name: _text(json['name']),
      nameVi: _text(json['name_vi']),
      bestPostId: _text(json['best_post_id']),
    );
  }

  String label(String locale) => I18n.label(nameVi, name, locale);
}
