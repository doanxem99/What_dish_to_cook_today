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

//House recipe quantities in grams; nutrition is computed from the USDA table.
const DISH_AMOUNTS = {
    'Beef noodle soup': { servings: 4, amounts: { Beef: 400, 'Rice noodle': 400, Ginger: 30, Onion: 150, 'Star anise': 5, 'Fish sauce': 40, Salt: 8 } },
    'Grilled pork with noodles': { servings: 2, amounts: { Pork: 300, 'Rice vermicelli': 200, Garlic: 10, 'Fish sauce': 30, Sugar: 20, Carrot: 80, Cilantro: 15 } },
    'Grilled pork vermicelli bowl': { servings: 2, amounts: { Pork: 300, 'Rice vermicelli': 200, Cucumber: 100, Carrot: 80, 'Bean sprouts': 100, 'Fish sauce': 30, Cilantro: 15 } },
    'Broken rice with pork': { servings: 2, amounts: { Rice: 200, Pork: 250, Egg: 60, Carrot: 60, Daikon: 60, 'Fish sauce': 25 } },
    'Fresh spring rolls': { servings: 3, amounts: { 'Rice paper': 60, Shrimp: 200, Pork: 200, Cucumber: 80, Cilantro: 15, 'Fish sauce': 25 } },
    'Vietnamese sandwich': { servings: 2, amounts: { Baguette: 200, Pork: 200, Carrot: 60, Daikon: 60, Cucumber: 60, Cilantro: 10, 'Soy sauce': 15 } },
    'Sour fish soup': { servings: 4, amounts: { Fish: 500, Tamarind: 40, Pineapple: 150, Tomato: 200, Okra: 150, 'Bean sprouts': 100, 'Fish sauce': 30 } },
    'Caramelised fish': { servings: 3, amounts: { Fish: 500, 'Fish sauce': 40, Sugar: 30, 'Black pepper': 3, Garlic: 15, 'Cooking oil': 20 } },
    'Water spinach with garlic': { servings: 2, amounts: { 'Water spinach': 400, Garlic: 15, 'Cooking oil': 20, 'Fish sauce': 15 } },
    'Egg fried rice': { servings: 2, amounts: { Rice: 200, Egg: 120, Scallion: 20, 'Soy sauce': 15, 'Cooking oil': 20 } },
    'Lemongrass chicken': { servings: 3, amounts: { Chicken: 600, Lemongrass: 30, Garlic: 15, 'Fish sauce': 30, Sugar: 15, 'Black pepper': 2 } },
    'Mung bean sweet soup': { servings: 4, amounts: { 'Mung bean': 200, Sugar: 100, 'Coconut milk': 200 } },
    'Sizzling rice pancake': { servings: 3, amounts: { 'Rice flour': 200, Turmeric: 5, 'Coconut milk': 200, Shrimp: 150, Pork: 150, 'Bean sprouts': 100, Scallion: 20 } }
}

const round = (value, digits) => {
    const factor = 10 ** digits
    return Math.round(value * factor) / factor
}

const recipeNutrition = function(recipe) {
    if (!recipe) {
        return null
    }
    const total = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sodium: 0 }
    for (const [name, grams] of Object.entries(recipe.amounts)) {
        const per100 = nutritionData.ingredients[name]?.per_100g
        if (!per100) {
            continue
        }
        for (const key of Object.keys(total)) {
            total[key] += (per100[key] || 0) * grams / 100
        }
    }
    const servings = recipe.servings || 1
    return {
        calories: Math.round(total.calories / servings),
        protein: round(total.protein / servings, 1),
        fat: round(total.fat / servings, 1),
        carbs: round(total.carbs / servings, 1),
        fiber: round(total.fiber / servings, 1),
        sodium: round(total.sodium / servings, 1)
    }
}

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
        servings: DISH_AMOUNTS[dish.name]?.servings || null,
        nutrition: recipeNutrition(DISH_AMOUNTS[dish.name]),
        ingredient_amounts: DISH_AMOUNTS[dish.name]
            ? Object.entries(DISH_AMOUNTS[dish.name].amounts).map(([name, grams]) => ({ ingredient_id: ingredientIds[name], grams }))
            : [],
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
