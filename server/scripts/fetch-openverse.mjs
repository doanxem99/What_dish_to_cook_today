//Re-source specific dish photos through Openverse (aggregated CC sources).
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '../public/pictures/dishes')
const creditsPath = path.join(here, 'seed-images.json')
const headers = { 'User-Agent': 'WhatDishToCookToday/1.0 (local demo seed)' }

const TARGETS = [
    ['Egg fried rice', 'com-chien', 'egg fried rice'],
    ['Caramelised fish', 'ca-kho', 'vietnamese caramelized fish'],
    ['Mung bean sweet soup', 'che-dau-xanh', 'vietnamese che dau xanh'],
    ['Water spinach with garlic', 'rau-muong', 'water spinach stir fry'],
    ['Lemongrass chicken', 'ga-nuong', 'lemongrass chicken']
]

const credits = JSON.parse(await fs.readFile(creditsPath, 'utf8'))

for (const [name, slug, query] of TARGETS) {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=all-cc&page_size=8`
    const response = await fetch(url, { headers })
    if (!response.ok) { console.log(`SEARCH-FAIL ${slug} ${response.status}`); continue }
    const data = await response.json()
    const pick = (data.results || []).find(item => /^https?:\/\//.test(item.url))
    if (!pick) { console.log(`NO-RESULT ${slug}`); continue }
    await new Promise(resolve => setTimeout(resolve, 1500))
    const image = await fetch(pick.url, { headers })
    if (!image.ok) { console.log(`DOWNLOAD-FAIL ${slug} ${image.status}`); continue }
    await fs.writeFile(path.join(outDir, `${slug}.jpg`), Buffer.from(await image.arrayBuffer()))
    credits[name] = {
        slug,
        term: query,
        file: `public/pictures/dishes/${slug}.jpg`,
        source: pick.foreign_landing_url || pick.url,
        license: (pick.license || 'unknown') + ' ' + (pick.license_version || ''),
        artist: pick.creator || 'unknown'
    }
    console.log(`OK ${slug} :: ${pick.title} :: ${pick.license}`)
    await new Promise(resolve => setTimeout(resolve, 1500))
}

await fs.writeFile(creditsPath, JSON.stringify(credits, null, 2) + '\n')
console.log('updated credits')
