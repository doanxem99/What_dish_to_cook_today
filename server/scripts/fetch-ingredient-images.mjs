//Fetches freely licensed photos for the ingredient catalog through Openverse.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '../public/pictures/ingredients')
const creditsPath = path.join(here, '../../catalog/images.json')
const headers = { 'User-Agent': 'WhatDishToCookToday/1.0 (local demo seed)' }

const TARGETS = [
    ['Beef', 'beef', 'raw beef steak'],
    ['Pork', 'pork', 'raw pork meat'],
    ['Chicken', 'chicken', 'raw chicken breast'],
    ['Fish', 'fish', 'fresh whole fish market'],
    ['Shrimp', 'shrimp', 'raw shrimp'],
    ['Egg', 'egg', 'chicken eggs'],
    ['Rice', 'rice', 'white rice grains'],
    ['Rice noodle', 'rice-noodle', 'rice noodles'],
    ['Rice vermicelli', 'rice-vermicelli', 'rice vermicelli'],
    ['Rice paper', 'rice-paper', 'rice paper wrappers'],
    ['Baguette', 'baguette', 'baguette bread'],
    ['Water spinach', 'water-spinach', 'water spinach'],
    ['Bean sprouts', 'bean-sprouts', 'mung bean sprouts'],
    ['Tomato', 'tomato', 'ripe tomatoes'],
    ['Pineapple', 'pineapple', 'pineapple fruit'],
    ['Okra', 'okra', 'okra vegetables'],
    ['Cucumber', 'cucumber', 'cucumber'],
    ['Carrot', 'carrot', 'carrots'],
    ['Daikon', 'daikon', 'daikon radish'],
    ['Garlic', 'garlic', 'garlic bulbs'],
    ['Onion', 'onion', 'onions'],
    ['Ginger', 'ginger', 'ginger root'],
    ['Lemongrass', 'lemongrass', 'lemongrass stalks'],
    ['Cilantro', 'cilantro', 'coriander leaves'],
    ['Scallion', 'scallion', 'spring onions'],
    ['Thai basil', 'thai-basil', 'thai basil'],
    ['Mung bean', 'mung-bean', 'mung beans'],
    ['Coconut milk', 'coconut-milk', 'coconut milk'],
    ['Tamarind', 'tamarind', 'tamarind pods'],
    ['Fish sauce', 'fish-sauce', 'fish sauce bottle'],
    ['Soy sauce', 'soy-sauce', 'soy sauce'],
    ['Sugar', 'sugar', 'white sugar'],
    ['Salt', 'salt', 'sea salt'],
    ['Black pepper', 'black-pepper', 'black peppercorns'],
    ['Cooking oil', 'cooking-oil', 'cooking oil bottle'],
    ['Star anise', 'star-anise', 'star anise spice'],
    ['Turmeric', 'turmeric', 'turmeric powder'],
    ['Rice flour', 'rice-flour', 'rice flour']
]

await fs.mkdir(outDir, { recursive: true })
const images = JSON.parse(await fs.readFile(creditsPath, 'utf8'))
const credits = images.ingredients

for (const [name, slug, query] of TARGETS) {
    if (credits[name]?.file) {
        console.log(`SKIP ${slug}`)
        continue
    }
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=all-cc&page_size=8`
    try {
        const response = await fetch(url, { headers })
        if (!response.ok) {
            console.log(`SEARCH-FAIL ${slug} ${response.status}`)
            continue
        }
        const data = await response.json()
        const pick = (data.results || []).find(item => /^https?:\/\//.test(item.url) && !/\.svg(\?|$)/i.test(item.url))
        if (!pick) {
            console.log(`NO-RESULT ${slug}`)
            continue
        }
        await new Promise(resolve => setTimeout(resolve, 1200))
        const image = await fetch(pick.url, { headers })
        if (!image.ok) {
            console.log(`DOWNLOAD-FAIL ${slug} ${image.status}`)
            continue
        }
        await fs.writeFile(path.join(outDir, `${slug}.jpg`), Buffer.from(await image.arrayBuffer()))
        credits[name] = {
            slug,
            term: query,
            file: `public/pictures/ingredients/${slug}.jpg`,
            source: pick.foreign_landing_url || pick.url,
            license: `${pick.license || 'unknown'} ${pick.license_version || ''}`.trim(),
            artist: pick.creator || 'unknown'
        }
        console.log(`OK ${slug} :: ${pick.title} :: ${pick.license}`)
    } catch (error) {
        console.log(`FAIL ${slug} ${error.message}`)
    }
    await new Promise(resolve => setTimeout(resolve, 600))
}

await fs.writeFile(creditsPath, JSON.stringify({ ...images, ingredients: credits }, null, 2))
console.log(`Wrote ${creditsPath}`)
