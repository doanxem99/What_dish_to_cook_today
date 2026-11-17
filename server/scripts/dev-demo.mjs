//Local demo stack: in-memory MongoDB, seeded catalog, then the real server.
//For UI verification only. Never used in production.
import { MongoMemoryServer } from 'mongodb-memory-server'

const mongod = await MongoMemoryServer.create({
    instance: { port: 27017, dbName: 'what_dish_to_cook_today' }
})
process.env.MONGODB_URI = mongod.getUri('what_dish_to_cook_today')
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-demo-secret'
process.env.DATABASE_WORKER_EXE = process.env.DATABASE_WORKER_EXE || 'C:/Windows/Temp/opencode/missing-worker.exe'

const connectionModule = await import('../config/database/connection.js')
const { collections } = connectionModule.default || connectionModule
const { Role, User, Ingredient, IngredientPost, Dish, DishPost, Comment } = collections
const bcrypt = (await import('bcryptjs')).default

const role = await Role.create({ name: 'user', description: 'User role' })
const user = await User.create({
    username: 'demo',
    email: 'demo@example.com',
    password: bcrypt.hashSync('demo1234', 10),
    roles: [role._id],
    created_at: new Date('2026-01-05T00:00:00Z')
})
const userId = user._id.toString()

const ingredientSeeds = [
    ['Beef', 'Thịt bò', 'Food', 'Rich red meat for stews and noodles', 'Thịt đỏ đậm đà cho món hầm và món nước'],
    ['Egg', 'Trứng', 'Food', 'Everyday protein for frying and boiling', 'Đạm quen thuộc để chiên hoặc luộc'],
    ['Salt', 'Muối', 'Spice', 'The base seasoning', 'Gia vị nền của mọi món'],
    ['Honey', 'Mật ong', 'Spice', 'Sweet glaze and dressing base', 'Lớp phủ ngọt và nền nước sốt'],
    ['Salmon', 'Cá hồi', 'Food', 'Oily fish for quick pan dishes', 'Cá béo cho món áp chảo nhanh'],
    ['Potato', 'Khoai tây', 'Food', 'Filling root for soups and roasts', 'Củ no bụng cho món súp và món nướng']
]

const ingredientIds = {}
for (const [name, nameVi, type, detail, detailVi] of ingredientSeeds) {
    const ingredient = await Ingredient.create({ name, name_vi: nameVi, best_post_id: '', is_need_update: false })
    const post = await IngredientPost.create({
        name,
        name_vi: nameVi,
        user_id: userId,
        ingredient_id: ingredient._id.toString(),
        unique_id: `${ingredient._id}_${userId}`,
        is_best_post: true,
        date_time: new Date(),
        points: 0,
        type,
        short_detail: detail,
        short_detail_vi: detailVi,
        profile_image: '',
        display_blocks: [
            { type: 'text', text: `${name} is kept in the shared catalog so every cook means the same thing.`, text_vi: `${nameVi} được lưu trong danh mục chung để mọi người hiểu cùng một nghĩa.`, font_size: 16, color: 'black' }
        ]
    })
    ingredient.best_post_id = post._id.toString()
    await ingredient.save()
    ingredientIds[name] = ingredient._id.toString()
}

let firstDishPostId = null

const dishes = [
    {
        name: 'Beef noodle soup', nameVi: 'Phở bò', detail: 'Slow broth, rice noodles, thin beef.', detailVi: 'Nước dùng hầm lâu, bánh phở, thịt bò thái mỏng.',
        image: 'public/pictures/dishs/Spaghetti.jpg', ingredients: ['Beef', 'Salt'],
        blocks: [
            ['Simmer the bones for three hours with salt and ginger.', 'Hầm xương ba tiếng với muối và gừng.'],
            ['Slice the beef thin, ladle the broth over the noodles, serve at once.', 'Thái thịt bò mỏng, chan nước dùng lên bánh phở, dọn ngay.']
        ]
    },
    {
        name: 'Egg fried rice', nameVi: 'Cơm chiên trứng', detail: 'Cold rice, egg, salt, ten minutes.', detailVi: 'Cơm nguội, trứng, muối, mười phút.',
        image: 'public/pictures/dishs/Spaghetti.jpg', ingredients: ['Egg', 'Salt'],
        blocks: [
            ['Fry the egg hard in a hot pan, then add cold rice and salt.', 'Chiên trứng kỹ trong chảo nóng, cho cơm nguội và muối vào.'],
            ['Press the rice against the pan until the grains separate.', 'Ép cơm vào chảo cho đến khi hạt cơm tơi ra.']
        ]
    },
    {
        name: 'Honey salmon', nameVi: 'Cá hồi mật ong', detail: 'Pan-seared salmon with a honey glaze.', detailVi: 'Cá hồi áp chảo sốt mật ong.',
        image: 'public/pictures/dishs/Spaghetti.jpg', ingredients: ['Salmon', 'Honey', 'Salt'],
        blocks: [
            ['Sear the salmon skin down until crisp.', 'Áp chảo cá hồi mặt da cho giòn.'],
            ['Glaze with honey and a pinch of salt off the heat.', 'Tắt lửa rồi phết mật ong và một nhúm muối.']
        ]
    }
]

for (const dishSeed of dishes) {
    const dish = await Dish.create({ name: dishSeed.name, name_vi: dishSeed.nameVi, best_post_id: '', is_need_update: false })
    const post = await DishPost.create({
        name: dishSeed.name,
        name_vi: dishSeed.nameVi,
        user_id: userId,
        dish_id: dish._id.toString(),
        unique_id: `${dish._id}_${userId}`,
        is_best_post: true,
        date_time: new Date(),
        points: 0,
        views: 3,
        comments: 0,
        ingredients: dishSeed.ingredients.map(name => ingredientIds[name]),
        short_detail: dishSeed.detail,
        short_detail_vi: dishSeed.detailVi,
        profile_image: dishSeed.image,
        display_blocks: dishSeed.blocks.map(([text, textVi]) => ({ type: 'text', text, text_vi: textVi, font_size: 16, color: 'black' }))
    })
    dish.best_post_id = post._id.toString()
    await dish.save()
    if (!firstDishPostId) {
        firstDishPostId = post._id.toString()
    }
}

await Comment.create({ dish_post_id: firstDishPostId, user_id: userId, body: 'The broth is the whole dish. Do not rush it.', date_time: new Date() })
await DishPost.updateOne({ _id: firstDishPostId }, { $inc: { comments: 1 } })

await import('../app.js')
console.log('DEMO_READY')
