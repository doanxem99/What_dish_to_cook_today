const templateImage = require('./template_image');
const templateBlock = require('./template_block');

const templateBlockGroup = 
{
    'default' : 
    {
        'icon' : 'public/gallery/template/text_block.png',
        'tooltip' : 'Default',
        'getData' : function()
        {
            let blocksReturn = [];
            let block;

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.bigText.getData()));
            block.text = "Nutritional value : ";
            block.font_weight = "bold";
            blocksReturn.push(block);
            
            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.text.getData()));
            block.text = "Calories ...";
            blocksReturn.push(block);

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.text.getData()));
            block.text = "...";
            blocksReturn.push(block);

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.text.getData()));
            block.text = "(*) Should be served with the main dish every day";
            blocksReturn.push(block);

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.bigText.getData()));
            block.text = "Popular dishes : ";
            block.font_weight = "bold";
            blocksReturn.push(block);
            
            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.text.getData()));
            block.text = "...";
            blocksReturn.push(block);

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.text.getData()));
            block.text = "...";
            blocksReturn.push(block);

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.bigText.getData()));
            block.text = "Things to know : ";
            block.font_weight = "bold";
            blocksReturn.push(block);

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.text.getData()));
            block.text = "Grown the most at ...";
            blocksReturn.push(block);

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.text.getData()));
            block.text = "Should eat in winter";
            blocksReturn.push(block);

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.text.getData()));
            block.text = "...";
            blocksReturn.push(block);

            block = JSON.parse(JSON.stringify(templateBlock.templateBlock.text.getData()));
            block.text = "...";
            blocksReturn.push(block);

            return blocksReturn;
        },
    }
}

const templateDish = {
    "name" : "Dish name",
    "ingredients":[],
    "short_detail":"Short detail",
    "profile_image": templateImage.templateImage,
    "display_blocks": templateBlockGroup.default.getData(),
};

module.exports = {
    templateBlockGroup,
    templateDish,
};