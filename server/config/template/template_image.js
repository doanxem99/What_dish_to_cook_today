const templateImage = "public/gallery/template/template_image.jpg";

const checkIsTemplateImage = function(_data)
{
    return templateImage == _data;
}

const templateImageBlock = {
    "type":"image",
    "src":templateImage, 
    "text" : "Info",
    "font_size":14,
    "text_align":"center",
    "color":"black"
};

module.exports = {
    templateImage,
    checkIsTemplateImage,
    templateImageBlock,
};