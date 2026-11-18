//Fetch exact Commons files chosen by hand for dishes whose first search result was wrong.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '../public/pictures/dishes')
const creditsPath = path.join(here, '../../catalog/images.json')
const headers = { 'User-Agent': 'WhatDishToCookToday/1.0 (local demo seed)' }

const PICKS = [
    ['Caramelised fish', 'ca-kho', 'File:Cá kho tộ.JPG'],
    ['Water spinach with garlic', 'rau-muong', 'File:Rau muống xào tỏi (tháng 9 năm 2018) (5).jpg'],
    ['Mung bean sweet soup', 'che-dau-xanh', 'File:Chè đậu xanh nha đam.jpg'],
    ['Lemongrass chicken', 'ga-nuong', 'File:Gà nướng muối ớt.jpg']
]

const images = JSON.parse(await fs.readFile(creditsPath, 'utf8'))
const credits = images.dishes

for (const [name, slug, title] of PICKS) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        titles: title,
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|mime',
        iiurlwidth: '900'
    })
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers })
    const data = await response.json()
    const page = Object.values(data.query?.pages || {})[0]
    const info = page?.imageinfo?.[0]
    if (!info) { console.log(`MISS ${slug}`); continue }
    await new Promise(resolve => setTimeout(resolve, 2500))
    const image = await fetch(info.thumburl || info.url, { headers })
    if (!image.ok) { console.log(`DOWNLOAD-FAIL ${slug} ${image.status}`); continue }
    await fs.writeFile(path.join(outDir, `${slug}.jpg`), Buffer.from(await image.arrayBuffer()))
    const meta = info.extmetadata || {}
    credits[name] = {
        slug,
        term: title,
        file: `public/pictures/dishes/${slug}.jpg`,
        source: info.descriptionurl,
        license: meta.LicenseShortName ? meta.LicenseShortName.value : 'unknown',
        artist: meta.Artist ? meta.Artist.value.replace(/<[^>]+>/g, '').trim() : 'unknown'
    }
    console.log(`OK ${slug} ${credits[name].license}`)
    await new Promise(resolve => setTimeout(resolve, 1500))
}

await fs.writeFile(creditsPath, JSON.stringify({ ...images, dishes: credits }, null, 2) + '\n')
console.log('updated credits')
