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
