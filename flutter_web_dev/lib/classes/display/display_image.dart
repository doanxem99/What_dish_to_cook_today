import 'dart:convert';

class DisplayImage{
  String src = "";
}

class UrlDisplayImage extends DisplayImage{
  String url = "";
}

class DisplayImageGenerator{
  static DisplayImage? fromJsonDecode(dynamic data){
    try{
      DisplayImage displayImage;
      if(data['type'] == 'url_image'){
        displayImage = UrlDisplayImage();
        if(data['url'] != null){
          (displayImage as UrlDisplayImage).url = data['url'];
        }
      }
      else{
        displayImage = DisplayImage();
      }
      //Set data
      if(data['src'] != null){
        displayImage.src = data['src'];
      }

      return displayImage;
    }
    catch(e){
      return null;
    }
  }

  static DisplayImage? fromJson(String jsonData){
    try{
      return fromJsonDecode(json.decode(jsonData));
    }catch(e){
      return null;
    }
  }
}