const fs = require('fs')
const path = require('path')

const serverRoot = path.join(__dirname, '..', '..')
const NUTRIENTS = ['calories', 'protein', 'fat', 'carbs', 'fiber', 'sodium']
const EXPECTED_INGREDIENTS = 38
const EXPECTED_DISHES = 13

const duplicateNames = function(rows)
{
    const seen = new Set()
    const duplicates = new Set()
    for (const row of rows) {
        if (seen.has(row.name)) {
            duplicates.add(row.name)
        }
        seen.add(row.name)
    }
    return Array.from(duplicates)
}

const checkImage = function(problems, label, image)
{
    if (!image) {
        return
    }
    if (!fs.existsSync(path.join(serverRoot, image))) {
        problems.push(`${label} image file is missing: ${image}`)
    }
}

//Human-readable catalog problems, [] when the catalog is valid.
const validateCatalog = function(catalog)
{
    const problems = []
    const ingredients = catalog.ingredients || []
    const dishes = catalog.dishes || []
    const known = new Set(ingredients.map(row => row.name))

    if (ingredients.length !== EXPECTED_INGREDIENTS) {
        problems.push(`ingredient count is ${ingredients.length}, expected ${EXPECTED_INGREDIENTS}`)
    }
    if (dishes.length !== EXPECTED_DISHES) {
        problems.push(`dish count is ${dishes.length}, expected ${EXPECTED_DISHES}`)
    }
    for (const name of duplicateNames(ingredients)) {
        problems.push(`duplicate ingredient name: ${name}`)
    }
    for (const name of duplicateNames(dishes)) {
        problems.push(`duplicate dish name: ${name}`)
    }

    for (const ingredient of ingredients) {
        const per100 = ingredient.nutrition && ingredient.nutrition.per_100g
        if (!per100) {
            problems.push(`ingredient "${ingredient.name}" has no nutrition`)
        } else {
            for (const key of NUTRIENTS) {
                if (typeof per100[key] !== 'number') {
                    problems.push(`ingredient "${ingredient.name}" is missing nutrition.${key}`)
                }
            }
        }
        checkImage(problems, `ingredient "${ingredient.name}"`, ingredient.image)
    }

    //nutrition.json is a second copy of the same numbers; keep the two in step
    const nutritionRows = catalog.nutrition || {}
    for (const ingredient of ingredients) {
        const row = nutritionRows[ingredient.name]
        if (!row) {
            problems.push(`nutrition.json has no entry for ingredient "${ingredient.name}"`)
            continue
        }
        if (!row.description) {
            problems.push(`nutrition.json entry for "${ingredient.name}" has no description`)
        }
        const per100 = row.per_100g || {}
        for (const key of NUTRIENTS) {
            if (typeof per100[key] !== 'number') {
                problems.push(`nutrition.json entry for "${ingredient.name}" is missing per_100g.${key}`)
            } else if (ingredient.nutrition && ingredient.nutrition.per_100g && per100[key] !== ingredient.nutrition.per_100g[key]) {
                problems.push(`nutrition.json ${key} for "${ingredient.name}" does not match the ingredient row (${per100[key]} vs ${ingredient.nutrition.per_100g[key]})`)
            }
        }
    }
    const ingredientNames = new Set(ingredients.map(row => row.name))
    for (const name of Object.keys(nutritionRows)) {
        if (!ingredientNames.has(name)) {
            problems.push(`nutrition.json has values for unknown ingredient "${name}"`)
        }
    }

    const dishNames = new Set(dishes.map(row => row.name))
    for (const name of Object.keys(catalog.amounts || {})) {
        if (!dishNames.has(name)) {
            problems.push(`dish-amounts.json has amounts for unknown dish "${name}"`)
        }
    }

    for (const dish of dishes) {
        if (!(dish.servings > 0)) {
            problems.push(`dish "${dish.name}" has no servings`)
        }
        for (const name of dish.ingredients || []) {
            if (!known.has(name)) {
                problems.push(`dish "${dish.name}" uses unknown ingredient "${name}"`)
            }
            if (!(dish.amounts && dish.amounts[name] > 0)) {
                problems.push(`dish "${dish.name}" has no amount for "${name}"`)
            }
        }
        checkImage(problems, `dish "${dish.name}"`, dish.image)
    }

    return problems
}

module.exports = { validateCatalog }
