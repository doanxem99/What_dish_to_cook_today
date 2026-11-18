const fs = require('fs')
const path = require('path')
const { validateCatalog } = require('./validate')

//Catalog lives at the repo root; resolve from this file so the cwd never matters.
const catalogDir = path.join(__dirname, '..', '..', '..', 'catalog')

const readJson = function(name)
{
    return JSON.parse(fs.readFileSync(path.join(catalogDir, name), 'utf8'))
}

//Load the canonical catalog. Dishes get their servings and grams merged in from dish-amounts.json.
const loadCatalog = function()
{
    const ingredients = readJson('ingredients.json')
    const dishes = readJson('dishes.json')
    const dishAmounts = readJson('dish-amounts.json')
    const images = readJson('images.json')
    const nutrition = readJson('nutrition.json')

    const amounts = {}
    for (const [dishName, entry] of Object.entries(dishAmounts)) {
        amounts[dishName] = entry.amounts
    }

    const dishDocs = dishes.map(function(dish)
    {
        const entry = dishAmounts[dish.name] || {}
        return Object.assign({}, dish, {
            servings: entry.servings || null,
            amounts: entry.amounts || {}
        })
    })

    return {
        ingredients,
        dishes: dishDocs,
        amounts,
        images,
        nutrition: nutrition.ingredients
    }
}

module.exports = { loadCatalog, validateCatalog }
