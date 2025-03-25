const templateImage = require('./template_image');

const templateBlock = 
{
    'text' : 
    {
        'icon' : 'public/gallery/template/text_block.png',
        'tooltip' : 'Text',
        'getData' : function(){
            return {
                'type' : 'text',
                'text' : 'text', 
                'font_size' : 14, 
                'font_weight' : 'normal', 
                'text_align' : 'left', 
                'color' : 'black'
            };
        },
    },
    'smallText' : 
    {
        'icon' : 'public/gallery/template/text_block.png',
        'tooltip' : 'Small text',
        'getData' : function(){
            return {
                'type' : 'text',
                'text' : 'text', 
                'font_size' : 10, 
                'font_weight' : 'normal', 
                'text_align' : 'left', 
                'color' : 'black'
            };
        },
    },
    'bigText' : 
    {
        'icon' : 'public/gallery/template/text_block.png',
        'tooltip' : 'Big text',
        'getData' : function(){
            return {
                'type' : 'text',
                'text' : 'text', 
                'font_size' : 20, 
                'font_weight' : 'normal', 
                'text_align' : 'left', 
                'color' : 'black'
            };
        },
    },
    'image' : 
    {
        'icon' : 'public/gallery/template/image_block.png',
        'tooltip' : 'Image',
        'getData' : function(){
            return {
                'type' : 'image',
                'src' : templateImage.templateImage,
                'text' : 'text', 
                'font_size' : 14, 
                'font_weight' : 'normal', 
                'text_align' : 'center', 
                'color' : 'black'
            };
        },
    }
}

module.exports = {
    templateBlock
};