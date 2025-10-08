import 'dart:convert';
import 'dart:ui';

import 'package:flutter/material.dart';

class DisplayText{
  String text = "";
  int fontSize = 12;
  Color color = Colors.black;
}

class UrlDisplayText extends DisplayText{
  String url = "";
}

class DisplayTextGenerator{
  static DisplayText? fromJsonDecode(dynamic data){
    try{
      DisplayText displayText;
      if(data['type'] == 'url_text'){
        displayText = UrlDisplayText();
        //Set url data
        if(data['url'] != null){
          (displayText as UrlDisplayText).url = data['url'];
        }
      }
      else{
        displayText = DisplayText();
      }
      //Set data
      if(data['text'] != null){
        displayText.text = data['text'];
      }
      if(data['font_size'] != null){
        displayText.fontSize = data['font_size'];
      }
      if(data['color'] != null){
        displayText.color = data['color'];
      }

      return displayText;
    }
    catch(e){
      return null;
    }
  }

  static DisplayText? fromJson(String jsonData){
    try{
      return fromJsonDecode(json.decode(jsonData));
    }catch(e){
      return null;
    }
  }

  static List<DisplayText> listFromJsonDecode(List<dynamic> datas){
    List<DisplayText> displayTexts = [];

    try{
      for (var element in datas)
      {
        DisplayText? displayText = fromJsonDecode(element);
        if(displayText != null){
          displayTexts.add(displayText);
        }
      }
    }
    catch(e){

    }

    return displayTexts;
  }

  static List<DisplayText> listFromJson(String jsonData){
    try{
      return listFromJsonDecode(json.decode(jsonData) as List<dynamic>);
    }
    catch(e){
      return [];
    }
  }
}