const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { loadCatalog, validateCatalog } = require('../config/catalog/index.js')

const serverRoot = path.join(__dirname, '..')
const NUTRIENTS = ['calories', 'protein', 'fat', 'carbs', 'fiber', 'sodium']

test('catalog holds 38 ingredients and 13 dishes', () => {
    const catalog = loadCatalog()
    assert.strictEqual(catalog.ingredients.length, 38)
    assert.strictEqual(catalog.dishes.length, 13)
})

test('catalog names are unique', () => {
    const catalog = loadCatalog()
    assert.strictEqual(new Set(catalog.ingredients.map(row => row.name)).size, catalog.ingredients.length)
    assert.strictEqual(new Set(catalog.dishes.map(row => row.name)).size, catalog.dishes.length)
})

test('every dish ingredient exists in the ingredient catalog', () => {
    const catalog = loadCatalog()
    const known = new Set(catalog.ingredients.map(row => row.name))
    for (const dish of catalog.dishes) {
        for (const name of dish.ingredients) {
            assert.ok(known.has(name), `${dish.name} uses unknown ingredient ${name}`)
        }
    }
})

test('every ingredient carries all six per-100g numbers', () => {
    const catalog = loadCatalog()
    for (const ingredient of catalog.ingredients) {
        assert.ok(ingredient.nutrition && ingredient.nutrition.per_100g, `${ingredient.name} has no nutrition`)
        for (const key of NUTRIENTS) {
            assert.strictEqual(typeof ingredient.nutrition.per_100g[key], 'number', `${ingredient.name} is missing ${key}`)
        }
    }
})

test('every dish has servings and grams for each of its ingredients', () => {
    const catalog = loadCatalog()
    for (const dish of catalog.dishes) {
        assert.ok(dish.servings > 0, `${dish.name} has no servings`)
        for (const name of dish.ingredients) {
            assert.ok(dish.amounts[name] > 0, `${dish.name} has no amount for ${name}`)
            assert.strictEqual(catalog.amounts[dish.name][name], dish.amounts[name])
        }
    }
})

test('every referenced image path exists under server/', () => {
    const catalog = loadCatalog()
    const referenced = [
        ...catalog.ingredients.map(row => row.image),
        ...catalog.dishes.map(row => row.image),
        ...Object.values(catalog.images.dishes).map(row => row.file),
        ...Object.values(catalog.images.ingredients).map(row => row.file)
    ]
    for (const image of referenced) {
        assert.ok(fs.existsSync(path.join(serverRoot, image)), `missing image file ${image}`)
    }
})

test('validateCatalog accepts the shipped catalog', () => {
    assert.deepStrictEqual(validateCatalog(loadCatalog()), [])
})

test('validateCatalog reports duplicate names, missing amounts and broken nutrition', () => {
    const catalog = loadCatalog()
    catalog.ingredients[1].name = catalog.ingredients[0].name
    catalog.dishes[0].amounts = {}
    catalog.dishes[1].servings = null
    catalog.ingredients[2].nutrition.per_100g.fiber = undefined
    const problems = validateCatalog(catalog)

    assert.ok(problems.some(row => /duplicate ingredient/i.test(row)))
    assert.ok(problems.some(row => /amount/i.test(row)))
    assert.ok(problems.some(row => /servings/i.test(row)))
    assert.ok(problems.some(row => /fiber/i.test(row)))
})
