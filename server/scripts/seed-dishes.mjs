//Dish catalog for the local demo, with full step lists in both languages.
export const DISHES = [
    {
        name: 'Beef noodle soup', nameVi: 'Phở bò',
        detail: 'Rice noodles in a long-simmered beef broth with charred aromatics.',
        detailVi: 'Bánh phở trong nước dùng bò hầm lâu với hành gừng nướng.',
        ingredients: ['Beef', 'Rice noodle', 'Ginger', 'Onion', 'Star anise', 'Fish sauce', 'Salt'],
        steps: [
            ['Char the onion and ginger under a grill until the skins blacken.', 'Nướng hành tây và gừng trên lửa đến khi vỏ cháy xém.'],
            ['Simmer beef bones with the charred aromatics and star anise for at least three hours, skimming the foam.', 'Hầm xương bò với hành gừng nướng và hoa hồi ít nhất ba giờ, vớt bọt.'],
            ['Strain the broth, then season with fish sauce and salt.', 'Lọc nước dùng, nêm nước mắm và muối.'],
            ['Blanch the rice noodles, add thinly sliced beef, and pour the hot broth over the bowl.', 'Trần bánh phở, xếp thịt bò thái mỏng rồi chan nước dùng nóng lên.'],
            ['Serve with herbs, lime and chilli on the side.', 'Dọn kèm rau thơm, chanh và ớt.'],
        ]
    },
    {
        name: 'Grilled pork with noodles', nameVi: 'Bún chả',
        detail: 'Hanoi-style grilled pork patties with vermicelli, herbs and dipping sauce.',
        detailVi: 'Thịt heo nướng kiểu Hà Nội ăn cùng bún, rau thơm và nước chấm.',
        ingredients: ['Pork', 'Rice vermicelli', 'Garlic', 'Fish sauce', 'Sugar', 'Carrot', 'Cilantro'],
        steps: [
            ['Mix minced pork with garlic, fish sauce, sugar and pepper, then shape small patties.', 'Trộn thịt heo băm với tỏi, nước mắm, đường và tiêu rồi nặn thành miếng nhỏ.'],
            ['Marinate for at least thirty minutes.', 'Ướp ít nhất ba mươi phút.'],
            ['Grill over charcoal until the edges char and the patties are cooked through.', 'Nướng trên than đến khi mép cháy cạnh và thịt chín đều.'],
            ['Make the dipping sauce with fish sauce, sugar, lime, garlic and chilli.', 'Pha nước chấm với nước mắm, đường, chanh, tỏi và ớt.'],
            ['Serve the pork in the sauce with cold vermicelli, pickled carrot and fresh herbs.', 'Dọn thịt trong bát nước chấm cùng bún nguội, cà rốt chua và rau thơm.'],
        ]
    },
    {
        name: 'Grilled pork vermicelli bowl', nameVi: 'Bún thịt nướng',
        detail: 'Southern cold noodle bowl with grilled pork, herbs and peanuts.',
        detailVi: 'Bún nguội kiểu miền Nam với thịt heo nướng, rau thơm và đậu phộng.',
        ingredients: ['Pork', 'Rice vermicelli', 'Cucumber', 'Carrot', 'Bean sprouts', 'Fish sauce', 'Cilantro'],
        steps: [
            ['Marinate sliced pork with lemongrass, garlic, fish sauce and sugar.', 'Ướp thịt heo thái lát với sả, tỏi, nước mắm và đường.'],
            ['Grill the pork until browned and slightly charred, then rest it.', 'Nướng thịt đến khi vàng nâu và hơi cháy cạnh rồi để nghỉ.'],
            ['Cook the vermicelli, rinse in cold water and drain well.', 'Luộc bún, xả nước lạnh và để ráo.'],
            ['Build bowls with noodles, cucumber, pickled carrot, bean sprouts and herbs.', 'Xếp bát với bún, dưa leo, cà rốt chua, giá đỗ và rau thơm.'],
            ['Top with the pork and a spoon of dipping sauce.', 'Cho thịt lên trên và rưới một thìa nước chấm.'],
        ]
    },
    {
        name: 'Broken rice with pork', nameVi: 'Cơm tấm',
        detail: 'Saigon broken rice plate with grilled pork, egg and pickles.',
        detailVi: 'Cơm tấm Sài Gòn với thịt heo nướng, trứng và đồ chua.',
        ingredients: ['Rice', 'Pork', 'Egg', 'Carrot', 'Daikon', 'Fish sauce'],
        steps: [
            ['Marinate pork with garlic, fish sauce, sugar and pepper.', 'Ướp thịt heo với tỏi, nước mắm, đường và tiêu.'],
            ['Grill until cooked through and let it rest before slicing.', 'Nướng đến khi chín rồi để nghỉ trước khi thái.'],
            ['Steam the broken rice and keep it warm.', 'Hấp cơm tấm và giữ nóng.'],
            ['Fry the egg with a soft yolk.', 'Chiên trứng với lòng đỏ còn mềm.'],
            ['Plate rice with pork, egg, pickled carrot and daikon, and a bowl of fish sauce.', 'Dọn cơm với thịt, trứng, cà rốt củ cải chua và bát nước mắm.'],
        ]
    },
    {
        name: 'Fresh spring rolls', nameVi: 'Gỏi cuốn',
        detail: 'Rice-paper rolls with shrimp, pork, herbs and lettuce.',
        detailVi: 'Cuốn bánh tráng với tôm, thịt heo, rau thơm và xà lách.',
        ingredients: ['Rice paper', 'Shrimp', 'Pork', 'Cucumber', 'Cilantro', 'Fish sauce'],
        steps: [
            ['Boil the shrimp and pork, then cool and slice them thin.', 'Luộc tôm và thịt heo, để nguội rồi thái mỏng.'],
            ['Cook the vermicelli and drain it well.', 'Luộc bún và để thật ráo.'],
            ['Soak each rice-paper sheet for a second until it softens.', 'Nhúng từng tờ bánh tráng một giây đến khi mềm.'],
            ['Layer herbs, noodles, cucumber and the fillings, then roll tightly.', 'Xếp rau, bún, dưa leo và nhân rồi cuốn chặt.'],
            ['Serve with a fish-sauce dip.', 'Dọn kèm nước mắm chấm.'],
        ]
    },
    {
        name: 'Vietnamese sandwich', nameVi: 'Bánh mì',
        detail: 'Baguette with pork, pickles, cucumber and cilantro.',
        detailVi: 'Bánh mì với thịt heo, đồ chua, dưa leo và rau mùi.',
        ingredients: ['Baguette', 'Pork', 'Carrot', 'Daikon', 'Cucumber', 'Cilantro', 'Soy sauce'],
        steps: [
            ['Pickle shredded carrot and daikon in vinegar, sugar and salt for an hour.', 'Ngâm cà rốt và củ cải thái sợi với giấm, đường và muối trong một giờ.'],
            ['Cook the pork with soy sauce and garlic until glossy.', 'Nấu thịt heo với nước tương và tỏi đến khi bóng mặt.'],
            ['Warm the baguette until the crust crisps.', 'Làm nóng bánh mì đến khi vỏ giòn.'],
            ['Slice it open and layer pork, pickles, cucumber and cilantro.', 'Rạch bánh và xếp thịt, đồ chua, dưa leo và rau mùi.'],
            ['Add a little soy sauce and serve immediately.', 'Thêm chút nước tương và dùng ngay.'],
        ]
    },
    {
        name: 'Sour fish soup', nameVi: 'Canh chua cá',
        detail: 'Mekong sour soup with fish, pineapple, tomato and okra.',
        detailVi: 'Canh chua miền Tây với cá, dứa, cà chua và đậu bắp.',
        ingredients: ['Fish', 'Tamarind', 'Pineapple', 'Tomato', 'Okra', 'Bean sprouts', 'Fish sauce'],
        steps: [
            ['Soak tamarind in warm water, then strain the pulp into the pot.', 'Ngâm me với nước ấm rồi lọc lấy nước cho vào nồi.'],
            ['Bring the sour water to a simmer and add the fish.', 'Đun nước me sôi nhẹ rồi cho cá vào.'],
            ['Add pineapple and tomato and cook until they soften.', 'Cho dứa và cà chua vào nấu đến khi mềm.'],
            ['Season with fish sauce and sugar to balance sour and salt.', 'Nêm nước mắm và đường để cân bằng chua mặn.'],
            ['Add okra and bean sprouts at the end so they stay crisp.', 'Cho đậu bắp và giá đỗ vào cuối để giữ độ giòn.'],
        ]
    },
    {
        name: 'Caramelised fish', nameVi: 'Cá kho tộ',
        detail: 'Fish braised in a clay pot with fish sauce, sugar and pepper.',
        detailVi: 'Cá kho trong nồi đất với nước mắm, đường và tiêu.',
        ingredients: ['Fish', 'Fish sauce', 'Sugar', 'Black pepper', 'Garlic', 'Cooking oil'],
        steps: [
            ['Clean the fish and pat it dry.', 'Làm sạch cá và thấm khô.'],
            ['Caramelise sugar in oil until it turns amber.', 'Thắng đường với dầu đến khi chuyển màu cánh gián.'],
            ['Turn the fish in the caramel, then add fish sauce and water.', 'Cho cá vào đảo qua caramel rồi thêm nước mắm và nước.'],
            ['Add garlic and pepper, then braise gently for forty minutes.', 'Thêm tỏi và tiêu rồi kho liu riu bốn mươi phút.'],
            ['Reduce until the sauce coats the fish, and serve with rice.', 'Kho đến khi sốt sánh bám cá, dọn cùng cơm.'],
        ]
    },
    {
        name: 'Water spinach with garlic', nameVi: 'Rau muống xào tỏi',
        detail: 'Fast stir-fry of water spinach with plenty of garlic.',
        detailVi: 'Rau muống xào nhanh với nhiều tỏi.',
        ingredients: ['Water spinach', 'Garlic', 'Cooking oil', 'Fish sauce'],
        steps: [
            ['Wash the water spinach and cut it into short lengths.', 'Rửa rau muống và cắt khúc ngắn.'],
            ['Crush the garlic and heat the pan until it smokes.', 'Đập tỏi và đun chảo đến khi bốc khói.'],
            ['Fry the garlic for ten seconds, then add the greens.', 'Phi tỏi mười giây rồi cho rau vào.'],
            ['Toss for one to two minutes until just wilted.', 'Đảo một đến hai phút đến khi rau vừa mềm.'],
            ['Season with fish sauce and serve at once.', 'Nêm nước mắm và dọn ngay.'],
        ]
    },
    {
        name: 'Egg fried rice', nameVi: 'Cơm chiên trứng',
        detail: 'Cold rice fried with egg, scallion and soy sauce.',
        detailVi: 'Cơm nguội chiên với trứng, hành lá và nước tương.',
        ingredients: ['Rice', 'Egg', 'Scallion', 'Soy sauce', 'Cooking oil'],
        steps: [
            ['Use rice cooked the day before and break up any clumps.', 'Dùng cơm nấu từ hôm trước và tơi các cục cơm.'],
            ['Heat oil and scramble the egg hard.', 'Đun dầu và chiên trứng thật chín.'],
            ['Add the rice and press it against the pan.', 'Cho cơm vào và ép xuống chảo.'],
            ['Keep tossing until the grains separate and smell toasted.', 'Đảo liên tục đến khi hạt cơm tơi và thơm.'],
            ['Season with soy sauce and finish with sliced scallion.', 'Nêm nước tương và rắc hành lá.'],
        ]
    },
    {
        name: 'Lemongrass chicken', nameVi: 'Gà nướng sả',
        detail: 'Chicken marinated in lemongrass, garlic and fish sauce, then grilled.',
        detailVi: 'Gà ướp sả, tỏi và nước mắm rồi nướng.',
        ingredients: ['Chicken', 'Lemongrass', 'Garlic', 'Fish sauce', 'Sugar', 'Black pepper'],
        steps: [
            ['Pound lemongrass with garlic into a rough paste.', 'Giã sả với tỏi thành hỗn hợp thô.'],
            ['Mix it with fish sauce, sugar and pepper.', 'Trộn với nước mắm, đường và tiêu.'],
            ['Marinate the chicken for at least an hour.', 'Ướp gà ít nhất một giờ.'],
            ['Grill over medium heat, turning so it cooks evenly.', 'Nướng với lửa vừa, trở đều để chín.'],
            ['Rest briefly, then serve with rice or noodles.', 'Để nghỉ một lát rồi dọn cùng cơm hoặc bún.'],
        ]
    },
    {
        name: 'Mung bean sweet soup', nameVi: 'Chè đậu xanh',
        detail: 'Sweet mung bean soup finished with coconut milk.',
        detailVi: 'Chè đậu xanh ngọt, thêm nước cốt dừa.',
        ingredients: ['Mung bean', 'Sugar', 'Coconut milk'],
        steps: [
            ['Soak the mung beans for two hours, then drain.', 'Ngâm đậu xanh hai giờ rồi để ráo.'],
            ['Simmer them until they soften and start to break down.', 'Nấu đến khi đậu mềm và bắt đầu bở.'],
            ['Add sugar and stir gently until it dissolves.', 'Thêm đường và khuấy nhẹ đến khi tan.'],
            ['Cook a few more minutes until the soup thickens.', 'Nấu thêm vài phút đến khi chè sánh lại.'],
            ['Spoon into bowls and pour coconut milk over each one.', 'Múc ra bát và chan nước cốt dừa lên.'],
        ]
    },
    {
        name: 'Sizzling rice pancake', nameVi: 'Bánh xèo',
        detail: 'Crisp turmeric rice pancake with shrimp, pork and bean sprouts.',
        detailVi: 'Bánh xèo giòn nghệ với tôm, thịt heo và giá đỗ.',
        ingredients: ['Rice flour', 'Turmeric', 'Coconut milk', 'Shrimp', 'Pork', 'Bean sprouts', 'Scallion'],
        steps: [
            ['Whisk rice flour, turmeric and coconut milk with water into a thin batter.', 'Trộn bột gạo, nghệ, nước cốt dừa với nước thành hỗn hợp loãng.'],
            ['Rest the batter for thirty minutes.', 'Để bột nghỉ ba mươi phút.'],
            ['Heat a wide pan with oil and pour in a thin layer of batter.', 'Đun chảo rộng với dầu và đổ một lớp bột mỏng.'],
            ['Add shrimp, pork and bean sprouts, then cover briefly.', 'Cho tôm, thịt và giá đỗ rồi đậy nắp ngắn.'],
            ['Cook until the edge lifts and crisps, then fold and serve.', 'Chiên đến khi mép bong và giòn, gấp đôi rồi dọn.'],
        ]
    }
]
