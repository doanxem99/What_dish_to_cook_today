import '../i18n/i18n.dart';
import '../state/app_state.dart';

class Nutrition {
  const Nutrition({this.calories = 0, this.protein = 0, this.fat = 0, this.carbs = 0, this.fiber = 0, this.sodium = 0});

  final double calories;
  final double protein;
  final double fat;
  final double carbs;
  final double fiber;
  final double sodium;

  bool get isEmpty => calories == 0 && protein == 0 && fat == 0 && carbs == 0;

  factory Nutrition.fromJson(dynamic json) {
    if (json is! Map) {
      return const Nutrition();
    }
    final source = json['per_100g'] is Map ? json['per_100g'] as Map : json;
    double value(String key) {
      final raw = source[key];
      return raw is num ? raw.toDouble() : 0;
    }

    return Nutrition(
      calories: value('calories'),
      protein: value('protein'),
      fat: value('fat'),
      carbs: value('carbs'),
      fiber: value('fiber'),
      sodium: value('sodium'),
    );
  }

  Map<String, dynamic> toJson() => {
        'calories': calories,
        'protein': protein,
        'fat': fat,
        'carbs': carbs,
        'fiber': fiber,
        'sodium': sodium,
      };

  static Nutrition scaled(Nutrition total, double factor) => Nutrition(
        calories: total.calories * factor,
        protein: total.protein * factor,
        fat: total.fat * factor,
        carbs: total.carbs * factor,
        fiber: total.fiber * factor,
        sodium: total.sodium * factor,
      );

  Nutrition operator +(Nutrition other) => Nutrition(
        calories: calories + other.calories,
        protein: protein + other.protein,
        fat: fat + other.fat,
        carbs: carbs + other.carbs,
        fiber: fiber + other.fiber,
        sodium: sodium + other.sodium,
      );
}

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
    this.shortDetail = '',
    this.shortDetailVi = '',
    this.image = '',
    this.nutrition = const Nutrition(),
  });

  final String id;
  final String name;
  final String nameVi;
  final String type;
  final String shortDetail;
  final String shortDetailVi;
  final String image;
  final Nutrition nutrition;

  factory IngredientRef.fromJson(dynamic json) {
    if (json is! Map) {
      return const IngredientRef(id: '', name: '');
    }
    return IngredientRef(
      id: _text(json['id'] ?? json['_id']),
      name: _text(json['name']),
      nameVi: _text(json['name_vi']),
      type: _text(json['type']).isEmpty ? 'Other' : _text(json['type']),
      shortDetail: _text(json['short_detail']),
      shortDetailVi: _text(json['short_detail_vi']),
      image: _text(json['profile_image']),
      nutrition: Nutrition.fromJson(json['nutrition']),
    );
  }

  String label(String locale) => I18n.label(nameVi, name, locale);

  String detail(String locale) => I18n.label(shortDetailVi, shortDetail, locale);

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
    this.missingDetails = const [],
    this.nutrition = const Nutrition(),
  });

  final String id;
  final String name;
  final String nameVi;
  final String shortDetail;
  final String shortDetailVi;
  final String image;
  final Nutrition nutrition;
  final int matchCount;
  final int totalIngredients;
  final List<IngredientRef> ingredientDetails;
  final List<IngredientRef> missingDetails;

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
      nutrition: Nutrition.fromJson(json['nutrition']),
      matchCount: _number(json['match_count']),
      totalIngredients: _number(json['total_ingredients']),
      ingredientDetails: IngredientRef.listFromJson(json['ingredients_detail']),
      missingDetails: IngredientRef.listFromJson(json['missing']),
    );
  }

  String label(String locale) => I18n.label(nameVi, name, locale);

  String detail(String locale) => I18n.label(shortDetailVi, shortDetail, locale);

  String ingredientLine(String locale) => ingredientDetails.map((item) => item.label(locale)).join(' · ');

  String missingLine(String locale) => missingDetails.map((item) => item.label(locale)).join(', ');

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

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'text': text,
      'text_vi': textVi,
      'src': src,
      'font_size': fontSize,
      'color': color,
      'font_weight': fontWeight,
      'font_style': fontStyle,
      'text_align': textAlign,
    };
  }

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
    this.type = '',
    this.servings = 0,
    this.nutrition = const Nutrition(),
    this.ingredientAmounts = const [],
    this.username = '',
    this.dateTime = '',
    this.extraImages = const [],
    this.blocks = const [],
    this.points = 0,
    this.ingredientIds = const [],
  });

  final String id;
  final String dishId;
  final String name;
  final String nameVi;
  final String shortDetail;
  final String shortDetailVi;
  final String image;
  final String type;
  final int servings;
  final Nutrition nutrition;
  final List<Map<String, dynamic>> ingredientAmounts;
  final String username;
  final String dateTime;
  final List<String> extraImages;
  final List<DisplayBlock> blocks;
  final int points;
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
      type: _text(json['type']),
      servings: _number(json['servings']),
      nutrition: Nutrition.fromJson(json['nutrition']),
      ingredientAmounts: json['ingredient_amounts'] is List
          ? (json['ingredient_amounts'] as List).whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList()
          : const [],
      username: _text(json['username']),
      dateTime: _text(json['date_time']),
      extraImages: images is List ? images.map(_text).where((item) => item.isNotEmpty).toList() : [],
      blocks: DisplayBlock.listFromJson(json['display_blocks']),
      points: _number(json['points']),
      ingredientIds: ingredientIds is List
          ? ingredientIds.map(_ingredientId).where((item) => item.isNotEmpty).toList()
          : [],
    );
  }

  ///The best-post answer sends ingredient objects, older answers send bare ids.
  static String _ingredientId(dynamic value) {
    if (value is Map) {
      return _text(value['ingredient_id'] ?? value['id'] ?? value['_id']);
    }
    return _text(value);
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

class Account {
  const Account({required this.id, required this.username, this.email = '', this.createdAt = '', this.backgroundImage = ''});

  final String id;
  final String username;
  final String email;
  final String createdAt;
  final String backgroundImage;

  factory Account.fromJson(dynamic json) {
    if (json is! Map) {
      return const Account(id: '', username: '');
    }
    return Account(
      id: _text(json['id'] ?? json['_id']),
      username: _text(json['username']),
      email: _text(json['email']),
      createdAt: _text(json['created_at']),
      backgroundImage: _text(json['background_image']),
    );
  }
}
