import 'dart:convert';

import 'package:what_dish_to_cook_today/classes/display/display_image.dart';
import 'package:what_dish_to_cook_today/classes/display/display_text.dart';

class DisplayBlock{

}

class TextDisplayBlock extends DisplayBlock{
  List<DisplayText> texts;

  TextDisplayBlock(this.texts);
}

class ImageDisplayBlock extends DisplayBlock{
  DisplayImage image;
  List<DisplayText> texts;

  ImageDisplayBlock(this.image, this.texts);
}

class DisplayBlockGenerator{
  static List<DisplayBlock> listFromJsonDecode(List<dynamic> datas){
    List<DisplayBlock> displayBlocks = [];
    try{
      for (var element in datas)
      {
        if(element['type'] == 'text'){
          //Editor blocks keep one text in "text"; older data uses a "texts" list
          List<DisplayText> texts = element['texts'] != null
              ? DisplayTextGenerator.listFromJsonDecode(element['texts'])
              : DisplayTextGenerator.listFromJsonDecode([element]);
          displayBlocks.add(TextDisplayBlock(texts));
        }
        else if(element['type'] == 'image'){
          DisplayImage? displayImage = null;
          List<DisplayText> displayTexts = [];
          //Editor blocks keep the image data on the block itself
          if(element['image'] != null || element['src'] != null){
            displayImage = DisplayImageGenerator.fromJsonDecode(element['image'] ?? element);
          }
          if(element['texts'] != null){
            displayTexts = DisplayTextGenerator.listFromJsonDecode(element['texts']);
          }

          //Only add if image != null
          if(displayImage != null){
            displayBlocks.add(ImageDisplayBlock(displayImage, displayTexts));
          }
        }
      }
    }
    catch(e){

    }

    return displayBlocks;
  }

  static List<DisplayBlock> listFromJson(String jsonData){
    try{
      return listFromJsonDecode(json.decode(jsonData) as List<dynamic>);
    }
    catch(e){
      return [];
    }
  }
}
