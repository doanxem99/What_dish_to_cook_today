//Local demo stack: in-memory MongoDB, seeded catalog, then the real server.
//For UI verification only. Never used in production.
import { MongoMemoryServer } from 'mongodb-memory-server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { INGREDIENTS } from './seed-catalog.mjs'
import { DISHES } from './seed-dishes.mjs'
import nutritionData from './nutrition.json' with { type: 'json' }

const here = path.dirname(fileURLToPath(import.meta.url))
let images = {}
try {
    images = JSON.parse(await fs.readFile(path.join(here, 'seed-images.json'), 'utf8'))
} catch (error) {
    images = {}
}

const mongod = await MongoMemoryServer.create({
    instance: { port: 27017, dbName: 'what_dish_to_cook_today' }
})
process.env.MONGODB_URI = mongod.getUri('what_dish_to_cook_today')
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-demo-secret'
process.env.DATABASE_WORKER_EXE = process.env.DATABASE_WORKER_EXE || 'C:/Windows/Temp/opencode/missing-worker.exe'
process.env.TRANSLATE_URL = process.env.TRANSLATE_URL || 'http://localhost:5000/translate'

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

const ingredientIds = {}
for (const [name, nameVi, type, detail, detailVi] of INGREDIENTS) {
    const nutrition = nutritionData.ingredients[name] || null
    const ingredient = await Ingredient.create({ name, name_vi: nameVi, best_post_id: '', nutrition, is_need_update: false })
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
        nutrition,
        short_detail: detail,
        short_detail_vi: detailVi,
        profile_image: '',
        display_blocks: [
            {
                type: 'text',
                text: `${name} is kept in the shared catalog so every cook means the same thing.`,
                text_vi: `${nameVi} được lưu trong danh mục chung để mọi người hiểu cùng một nghĩa.`,
                font_size: 14,
                color: 'black'
            }
        ]
    })
    ingredient.best_post_id = post._id.toString()
    await ingredient.save()
    ingredientIds[name] = ingredient._id.toString()
}

let featuredPostId = null
for (const dish of DISHES) {
    const dishDoc = await Dish.create({
        name: dish.name,
        name_vi: dish.nameVi,
        best_post_id: '',
        is_need_update: false
    })
    const post = await DishPost.create({
        name: dish.name,
        name_vi: dish.nameVi,
        user_id: userId,
        dish_id: dishDoc._id.toString(),
        unique_id: `${dishDoc._id}_${userId}`,
        is_best_post: true,
        date_time: new Date(),
        points: 0,
        views: 0,
        comments: 0,
        ingredients: dish.ingredients.map(name => ingredientIds[name]).filter(Boolean),
        short_detail: dish.detail,
        short_detail_vi: dish.detailVi,
        profile_image: images[dish.name] ? images[dish.name].file : '',
        display_blocks: dish.steps.map(([text, textVi]) => ({ type: 'text', text, text_vi: textVi, font_size: 14, color: 'black' }))
    })
    dishDoc.best_post_id = post._id.toString()
    await dishDoc.save()
    if (!featuredPostId) {
        featuredPostId = post._id.toString()
    }
}

await Comment.create({
    dish_post_id: featuredPostId,
    user_id: userId,
    body: 'The broth is the whole dish. Do not rush it.',
    date_time: new Date()
})
await DishPost.updateOne({ _id: featuredPostId }, { $inc: { comments: 1 } })

await import('../app.js')
console.log('DEMO_READY')
