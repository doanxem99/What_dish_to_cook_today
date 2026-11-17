//Sample catalog for the local demo. Facts follow common Vietnamese cooking references
//(Wikipedia's dish articles and standard ingredient lists); the wording is our own.

export const INGREDIENTS = [
    ['Beef', 'Thịt bò', 'Food', 'Red meat used in phở and stir-fries', 'Thịt đỏ dùng cho phở và món xào'],
    ['Pork', 'Thịt heo', 'Food', 'Grilled, minced or braised in Vietnamese dishes', 'Nướng, băm hoặc kho trong món Việt'],
    ['Chicken', 'Thịt gà', 'Food', 'Poultry for soups, grills and braises', 'Gia cầm cho canh, món nướng và món kho'],
    ['Fish', 'Cá', 'Food', 'Freshwater or sea fish for soups and braises', 'Cá nước ngọt hoặc cá biển cho canh và kho'],
    ['Shrimp', 'Tôm', 'Food', 'Used fresh in rolls, soups and pancakes', 'Dùng tươi trong món cuốn, canh và bánh xèo'],
    ['Egg', 'Trứng', 'Food', 'Fried, boiled or used to bind', 'Chiên, luộc hoặc dùng để kết dính'],
    ['Rice', 'Gạo', 'Food', 'Staple grain, steamed or fried', 'Ngũ cốc chính, nấu hoặc chiên'],
    ['Rice noodle', 'Bánh phở', 'Food', 'Flat rice noodles for phở', 'Bánh phở dẹt dùng cho món phở'],
    ['Rice vermicelli', 'Bún', 'Food', 'Thin rice noodles for bún dishes', 'Sợi bún nhỏ cho các món bún'],
    ['Rice paper', 'Bánh tráng', 'Food', 'Sheets for fresh and fried rolls', 'Bánh dùng để cuốn tươi hoặc chiên'],
    ['Baguette', 'Bánh mì', 'Food', 'Wheat roll for the sandwich of the same name', 'Bánh mì lúa mì cho món bánh mì'],
    ['Water spinach', 'Rau muống', 'Food', 'Leafy green for quick stir-fries', 'Rau lá xanh cho món xào nhanh'],
    ['Bean sprouts', 'Giá đỗ', 'Food', 'Crunchy sprouts for soups and rolls', 'Giá giòn cho canh và món cuốn'],
    ['Tomato', 'Cà chua', 'Food', 'Acid base for soups and sauces', 'Nền vị chua cho canh và sốt'],
    ['Pineapple', 'Dứa', 'Fruit', 'Sweet-sour fruit for sour soup', 'Trái chua ngọt cho canh chua'],
    ['Okra', 'Đậu bắp', 'Food', 'Thickens sour soup', 'Làm sánh món canh chua'],
    ['Cucumber', 'Dưa leo', 'Food', 'Cool crunch for salads and sandwiches', 'Dưa giòn mát cho gỏi và bánh mì'],
    ['Carrot', 'Cà rốt', 'Food', 'Pickled with daikon for sandwiches', 'Muối chua cùng củ cải cho bánh mì'],
    ['Daikon', 'Củ cải trắng', 'Food', 'Pickled with carrot', 'Muối chua cùng cà rốt'],
    ['Garlic', 'Tỏi', 'Spice', 'Aromatic base for marinades and stir-fries', 'Nền thơm cho ướp và xào'],
    ['Onion', 'Hành tây', 'Spice', 'Charred for phở broth, raw in salads', 'Nướng cho nước dùng phở, ăn sống trong gỏi'],
    ['Ginger', 'Gừng', 'Spice', 'Charred for broth, grated for marinades', 'Nướng cho nước dùng, bào cho ướp'],
    ['Lemongrass', 'Sả', 'Spice', 'Citrus-scented stalk for grills', 'Thân thơm mùi chanh cho món nướng'],
    ['Cilantro', 'Rau mùi', 'Spice', 'Fresh herb for garnish', 'Rau thơm dùng để rắc'],
    ['Scallion', 'Hành lá', 'Spice', 'Sliced green for garnish', 'Hành lá thái nhỏ để rắc'],
    ['Thai basil', 'Húng quế', 'Spice', 'Anise-scented herb for soups and rolls', 'Rau thơm mùi hồi cho canh và món cuốn'],
    ['Mung bean', 'Đậu xanh', 'Food', 'Base for sweet soup', 'Nguyên liệu cho món chè'],
    ['Coconut milk', 'Nước cốt dừa', 'Food', 'Creamy base for curries and sweet soup', 'Nền béo cho cà ri và chè'],
    ['Tamarind', 'Me', 'Fruit', 'Sour pulp for sour soup', 'Thịt quả chua cho canh chua'],
    ['Fish sauce', 'Nước mắm', 'Spice', 'Fermented salty sauce for seasoning and dipping', 'Nước chấm lên men mặn để nêm và chấm'],
    ['Soy sauce', 'Nước tương', 'Spice', 'Salty sauce for fried rice and glazes', 'Nước sốt mặn cho cơm chiên và sốt'],
    ['Sugar', 'Đường', 'Spice', 'Balances salt and sour', 'Cân bằng vị mặn và chua'],
    ['Salt', 'Muối', 'Spice', 'Base seasoning', 'Gia vị nền'],
    ['Black pepper', 'Tiêu', 'Spice', 'Ground heat for marinades and soups', 'Tiêu xay cho ướp và canh'],
    ['Cooking oil', 'Dầu ăn', 'Other', 'Neutral oil for frying', 'Dầu trung tính để chiên'],
    ['Star anise', 'Hoa hồi', 'Spice', 'Phở spice with a warm anise aroma', 'Gia vị phở, mùi hồi ấm'],
    ['Turmeric', 'Nghệ', 'Spice', 'Yellow colour for bánh xèo', 'Màu vàng cho bánh xèo'],
    ['Rice flour', 'Bột gạo', 'Food', 'Batter base for bánh xèo', 'Nền bột cho bánh xèo']
]

//Dish entries below are the original short set; the demo now reads DISHES from seed-dishes.mjs.
export const DISHES = [
    {
        name: 'Beef noodle soup', nameVi: 'Phở bò',
        detail: 'Rice noodles in a long-simmered beef broth with charred aromatics.',
        detailVi: 'Bánh phở trong nước dùng bò hầm lâu với hành gừng nướng.',
        ingredients: ['Beef', 'Rice noodle', 'Ginger', 'Onion', 'Star anise', 'Fish sauce', 'Salt'],
        block: 'Char the onion and ginger, simmer them with beef bones and star anise for hours, then season with fish sauce and salt. Pour over rice noodles and sliced beef.',
        blockVi: 'Nướng hành tây và gừng, hầm cùng xương bò và hoa hồi trong nhiều giờ, nêm nước mắm và muối. Chan lên bánh phở và thịt bò thái mỏng.'
    },
    {
        name: 'Grilled pork with noodles', nameVi: 'Bún chả',
        detail: 'Hanoi-style grilled pork patties with vermicelli, herbs and dipping sauce.',
        detailVi: 'Thịt heo nướng kiểu Hà Nội ăn cùng bún, rau thơm và nước chấm.',
        ingredients: ['Pork', 'Rice vermicelli', 'Garlic', 'Fish sauce', 'Sugar', 'Carrot', 'Cilantro'],
        block: 'Marinate pork with garlic, fish sauce and sugar, then grill over charcoal. Serve with cold vermicelli, herbs and a bowl of dipping sauce.',
        blockVi: 'Ướp thịt heo với tỏi, nước mắm và đường rồi nướng than. Ăn cùng bún nguội, rau thơm và bát nước chấm.'
    },
    {
        name: 'Grilled pork vermicelli bowl', nameVi: 'Bún thịt nướng',
        detail: 'Southern cold noodle bowl with grilled pork, herbs and peanuts.',
        detailVi: 'Bún nguội kiểu miền Nam với thịt heo nướng, rau thơm và đậu phộng.',
        ingredients: ['Pork', 'Rice vermicelli', 'Cucumber', 'Carrot', 'Bean sprouts', 'Fish sauce', 'Cilantro'],
        block: 'Grill lemongrass-marinated pork and let it rest. Build the bowl with cold vermicelli, cucumber, pickled carrot, herbs and a spoon of dipping sauce.',
        blockVi: 'Nướng thịt heo ướp sả rồi để nghỉ. Xếp bát với bún nguội, dưa leo, cà rốt muối chua, rau thơm và một thìa nước chấm.'
    },
    {
        name: 'Broken rice with pork', nameVi: 'Cơm tấm',
        detail: 'Saigon broken rice plate with grilled pork, egg and pickles.',
        detailVi: 'Cơm tấm Sài Gòn với thịt heo nướng, trứng và đồ chua.',
        ingredients: ['Rice', 'Pork', 'Egg', 'Carrot', 'Daikon', 'Fish sauce'],
        block: 'Grill the marinated pork and fry an egg. Serve over broken rice with pickled carrot and daikon, and a small bowl of fish sauce.',
        blockVi: 'Nướng thịt heo đã ướp và chiên một quả trứng. Dọn với cơm tấm, cà rốt củ cải muối chua và bát nước mắm.'
    },
    {
        name: 'Fresh spring rolls', nameVi: 'Gỏi cuốn',
        detail: 'Rice-paper rolls with shrimp, pork, herbs and lettuce.',
        detailVi: 'Cuốn bánh tráng với tôm, thịt heo, rau thơm và xà lách.',
        ingredients: ['Rice paper', 'Shrimp', 'Pork', 'Cucumber', 'Cilantro', 'Fish sauce'],
        block: 'Boil shrimp and pork, then slice them thin. Soak the rice paper briefly, layer herbs, noodles and filling, and roll tightly.',
        blockVi: 'Luộc tôm và thịt heo rồi thái mỏng. Nhúng bánh tráng nhanh, xếp rau thơm, bún và nhân rồi cuốn chặt tay.'
    },
    {
        name: 'Vietnamese sandwich', nameVi: 'Bánh mì',
        detail: 'Baguette with pork, pickles, cucumber and cilantro.',
        detailVi: 'Bánh mì với thịt heo, đồ chua, dưa leo và rau mùi.',
        ingredients: ['Baguette', 'Pork', 'Carrot', 'Daikon', 'Cucumber', 'Cilantro', 'Soy sauce'],
        block: 'Warm the baguette until crisp. Fill it with pork, pickled carrot and daikon, cucumber and cilantro, then add a little soy sauce.',
        blockVi: 'Làm nóng bánh mì cho giòn. Kẹp thịt heo, cà rốt củ cải muối chua, dưa leo và rau mùi, thêm chút nước tương.'
    },
    {
        name: 'Sour fish soup', nameVi: 'Canh chua cá',
        detail: 'Mekong sour soup with fish, pineapple, tomato and okra.',
        detailVi: 'Canh chua miền Tây với cá, dứa, cà chua và đậu bắp.',
        ingredients: ['Fish', 'Tamarind', 'Pineapple', 'Tomato', 'Okra', 'Bean sprouts', 'Fish sauce'],
        block: 'Simmer tamarind in water and strain it. Add fish, pineapple and tomato, then okra and bean sprouts at the end, seasoned with fish sauce.',
        blockVi: 'Nấu me với nước rồi lọc lấy nước. Cho cá, dứa và cà chua vào, cuối cùng là đậu bắp và giá đỗ, nêm nước mắm.'
    },
    {
        name: 'Caramelised fish', nameVi: 'Cá kho tộ',
        detail: 'Fish braised in a clay pot with fish sauce, sugar and pepper.',
        detailVi: 'Cá kho trong nồi đất với nước mắm, đường và tiêu.',
        ingredients: ['Fish', 'Fish sauce', 'Sugar', 'Black pepper', 'Garlic', 'Cooking oil'],
        block: 'Caramelise sugar in oil, add fish and turn it in the glaze. Add fish sauce, water, garlic and pepper, then braise gently until the sauce thickens.',
        blockVi: 'Thắng đường với dầu, cho cá vào đảo đều. Thêm nước mắm, nước, tỏi và tiêu rồi kho liu riu đến khi sốt sánh lại.'
    },
    {
        name: 'Water spinach with garlic', nameVi: 'Rau muống xào tỏi',
        detail: 'Fast stir-fry of water spinach with plenty of garlic.',
        detailVi: 'Rau muống xào nhanh với nhiều tỏi.',
        ingredients: ['Water spinach', 'Garlic', 'Cooking oil', 'Fish sauce'],
        block: 'Heat the pan hard, fry garlic until fragrant, add water spinach and toss for a minute. Season with a splash of fish sauce.',
        blockVi: 'Đun chảo thật nóng, phi tỏi thơm, cho rau muống vào đảo khoảng một phút. Nêm một chút nước mắm.'
    },
    {
        name: 'Egg fried rice', nameVi: 'Cơm chiên trứng',
        detail: 'Cold rice fried with egg, scallion and soy sauce.',
        detailVi: 'Cơm nguội chiên với trứng, hành lá và nước tương.',
        ingredients: ['Rice', 'Egg', 'Scallion', 'Soy sauce', 'Cooking oil'],
        block: 'Fry the egg in a hot pan, add cold rice and press it against the pan until the grains separate. Finish with scallion and soy sauce.',
        blockVi: 'Chiên trứng trong chảo nóng, cho cơm nguội vào và ép xuống chảo đến khi hạt cơm tơi ra. Rắc hành lá và nêm nước tương.'
    },
    {
        name: 'Lemongrass chicken', nameVi: 'Gà nướng sả',
        detail: 'Chicken marinated in lemongrass, garlic and fish sauce, then grilled.',
        detailVi: 'Gà ướp sả, tỏi và nước mắm rồi nướng.',
        ingredients: ['Chicken', 'Lemongrass', 'Garlic', 'Fish sauce', 'Sugar', 'Black pepper'],
        block: 'Pound lemongrass with garlic, mix with fish sauce, sugar and pepper, and marinate the chicken for an hour. Grill until the skin chars.',
        blockVi: 'Giã sả với tỏi, trộn nước mắm, đường và tiêu rồi ướp gà khoảng một giờ. Nướng đến khi da cháy cạnh.'
    },
    {
        name: 'Mung bean sweet soup', nameVi: 'Chè đậu xanh',
        detail: 'Sweet mung bean soup finished with coconut milk.',
        detailVi: 'Chè đậu xanh ngọt, thêm nước cốt dừa.',
        ingredients: ['Mung bean', 'Sugar', 'Coconut milk'],
        block: 'Soak the mung beans, simmer them until soft, then sweeten and stir until the beans break down. Spoon coconut milk over each bowl.',
        blockVi: 'Ngâm đậu xanh, nấu đến khi mềm rồi thêm đường và khuấy đến khi đậu bở. Chan nước cốt dừa lên mỗi bát.'
    },
    {
        name: 'Sizzling rice pancake', nameVi: 'Bánh xèo',
        detail: 'Crisp turmeric rice pancake with shrimp, pork and bean sprouts.',
        detailVi: 'Bánh xèo giòn nghệ với tôm, thịt heo và giá đỗ.',
        ingredients: ['Rice flour', 'Turmeric', 'Coconut milk', 'Shrimp', 'Pork', 'Bean sprouts', 'Scallion'],
        block: 'Whisk rice flour, turmeric and coconut milk into a thin batter. Pour into a hot oiled pan, add shrimp, pork and sprouts, and cook until the edge lifts.',
        blockVi: 'Trộn bột gạo, nghệ và nước cốt dừa thành hỗn hợp loãng. Đổ vào chảo nóng có dầu, thêm tôm, thịt và giá, chiên đến khi mép bánh bong ra.'
    }
]
