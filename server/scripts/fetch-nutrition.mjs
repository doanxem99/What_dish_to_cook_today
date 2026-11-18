//Fetches per-100g nutrient values for the catalog from USDA FoodData Central.
//Run: node scripts/fetch-nutrition.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outFile = path.join(root, 'scripts', 'nutrition.json');
const { INGREDIENTS } = await import('./seed-catalog.mjs');

const NUTRIENTS = {
  calories: 208,
  protein: 203,
  fat: 204,
  carbs: 205,
  fiber: 291,
  sodium: 307
};

async function search(name) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&pageSize=5&dataType=Foundation,SR%20Legacy&query=${encodeURIComponent(name)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${name}: ${response.status}`);
  }
  const payload = await response.json();
  const food = (payload.foods || []).find(entry => entry.foodNutrients?.length);
  if (!food) {
    return null;
  }
  const value = code => {
    const row = food.foodNutrients.find(nutrient => nutrient.nutrientId === code);
    return row && typeof row.value === 'number' ? row.value : null;
  };
  return {
    fdc_id: food.fdcId,
    description: food.description,
    per_100g: Object.fromEntries(Object.entries(NUTRIENTS).map(([key, code]) => [key, value(code)]))
  };
}

const result = {};
for (const [name] of INGREDIENTS) {
  try {
    result[name] = await search(name);
    console.log(`${name}: ${result[name] ? 'ok' : 'none'}`);
  } catch (error) {
    result[name] = { error: error.message };
    console.log(`${name}: ${error.message}`);
  }
  await new Promise(resolve => setTimeout(resolve, 250));
}

fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(`Wrote ${outFile}`);
