//Local demo stack: in-memory MongoDB, seeded catalog, then the real server.
//For UI verification only. Never used in production.
import { MongoMemoryServer } from 'mongodb-memory-server'
import { loadCatalog, validateCatalog } from '../config/catalog/index.js'

const catalog = loadCatalog()
const problems = validateCatalog(catalog)
if (problems.length > 0) {
    throw new Error(`Catalog is invalid:\n${problems.map(problem => `- ${problem}`).join('\n')}`)
}
const nutritionData = catalog.nutrition

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
        const per100 = nutritionData[name]?.per_100g
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
for (const row of catalog.ingredients) {
    const { name, name_vi: nameVi, type, short_detail: detail, short_detail_vi: detailVi, nutrition } = row
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
        profile_image: row.image || '',
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
for (const dish of catalog.dishes) {
    const dishDoc = await Dish.create({
        name: dish.name,
        name_vi: dish.name_vi,
        best_post_id: '',
        is_need_update: false
    })
    const amounts = { servings: dish.servings, amounts: dish.amounts }
    const post = await DishPost.create({
        name: dish.name,
        name_vi: dish.name_vi,
        user_id: userId,
        dish_id: dishDoc._id.toString(),
        unique_id: `${dishDoc._id}_${userId}`,
        is_best_post: true,
        date_time: new Date(),
        points: 0,
        views: 0,
        comments: 0,
        ingredients: dish.ingredients.map(name => ingredientIds[name]).filter(Boolean),
        short_detail: dish.short_detail,
        short_detail_vi: dish.short_detail_vi,
        profile_image: dish.image || '',
        servings: dish.servings || null,
        nutrition: recipeNutrition(amounts),
        ingredient_amounts: Object.entries(dish.amounts).map(([name, grams]) => ({ ingredient_id: ingredientIds[name], grams })),
        display_blocks: dish.steps.map(step => ({ type: 'text', text: step.text, text_vi: step.text_vi, font_size: 14, color: 'black' }))
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
