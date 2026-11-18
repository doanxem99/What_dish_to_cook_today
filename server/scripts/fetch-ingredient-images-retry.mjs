//Retries the ingredient photos Openverse rate-limited on the first pass.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '../public/pictures/ingredients')
const creditsPath = path.join(here, '../../catalog/images.json')
const headers = { 'User-Agent': 'WhatDishToCookToday/1.0 (local demo seed)' }

const TARGETS = [
    ['Beef', 'beef', 'raw beef'],
    ['Pork', 'pork', 'raw pork loin'],
    ['Chicken', 'chicken', 'whole raw chicken'],
    ['Fish', 'fish', 'fresh fish market'],
    ['Shrimp', 'shrimp', 'prawns raw'],
    ['Egg', 'egg', 'chicken eggs basket'],
    ['Rice', 'rice', 'jasmine rice grains'],
    ['Rice noodle', 'rice-noodle', 'dried rice noodles'],
    ['Fish sauce', 'fish-sauce', 'fish sauce'],
    ['Sugar', 'sugar', 'white sugar bowl'],
    ['Rice flour', 'rice-flour', 'rice flour']
]

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const images = JSON.parse(await fs.readFile(creditsPath, 'utf8'))
const credits = images.ingredients

for (const [name, slug, query] of TARGETS) {
    let done = false
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
        try {
            const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=all-cc&page_size=10`
            const response = await fetch(url, { headers })
            if (!response.ok) {
                console.log(`SEARCH-FAIL ${slug} ${response.status} try ${attempt}`)
                await sleep(8000)
                continue
            }
            const data = await response.json()
            const pick = (data.results || []).find(item => /^https?:\/\//.test(item.url) && !/\.svg(\?|$)/i.test(item.url))
            if (!pick) {
                console.log(`NO-RESULT ${slug}`)
                break
            }
            await sleep(1500)
            const image = await fetch(pick.url, { headers })
            if (!image.ok) {
                console.log(`DOWNLOAD-FAIL ${slug} ${image.status}`)
                await sleep(8000)
                continue
            }
            const bytes = Buffer.from(await image.arrayBuffer())
            if (bytes.length < 6000) {
                console.log(`SMALL ${slug} ${bytes.length}`)
                await sleep(4000)
                continue
            }
            await fs.writeFile(path.join(outDir, `${slug}.jpg`), bytes)
            credits[name] = {
                slug,
                term: query,
                file: `public/pictures/ingredients/${slug}.jpg`,
                source: pick.foreign_landing_url || pick.url,
                license: `${pick.license || 'unknown'} ${pick.license_version || ''}`.trim(),
                artist: pick.creator || 'unknown'
            }
            console.log(`OK ${slug} ${bytes.length} :: ${pick.title}`)
            done = true
        } catch (error) {
            console.log(`FAIL ${slug} ${error.message}`)
            await sleep(8000)
        }
    }
    await sleep(12000)
}

await fs.writeFile(creditsPath, JSON.stringify({ ...images, ingredients: credits }, null, 2))
console.log(`Wrote ${creditsPath}`)
