//Fetch a freely licensed photo per dish from Wikimedia Commons.
//Writes server/public/pictures/dishes/<slug>.jpg and dishes images in catalog/images.json with provenance.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '../public/pictures/dishes')
const creditsPath = path.join(here, '../../catalog/images.json')

const DISHES = [
    ['Beef noodle soup', 'pho-bo', ['pho bo', 'phở bò']],
    ['Grilled pork with noodles', 'bun-cha', ['bun cha', 'bún chả']],
    ['Grilled pork vermicelli bowl', 'bun-thit-nuong', ['bun thit nuong', 'bún thịt nướng']],
    ['Broken rice with pork', 'com-tam', ['com tam', 'cơm tấm']],
    ['Fresh spring rolls', 'goi-cuon', ['goi cuon', 'gỏi cuốn']],
    ['Vietnamese sandwich', 'banh-mi', ['banh mi sandwich', 'bánh mì thịt']],
    ['Sour fish soup', 'canh-chua', ['canh chua', 'canh chua cá']],
    ['Caramelised fish', 'ca-kho', ['ca kho to', 'cá kho tộ']],
    ['Water spinach with garlic', 'rau-muong', ['rau muong', 'rau muống xào']],
    ['Egg fried rice', 'com-chien', ['com chien', 'cơm chiên']],
    ['Lemongrass chicken', 'ga-nuong', ['ga nuong', 'gà nướng']],
    ['Mung bean sweet soup', 'che-dau-xanh', ['che dau xanh', 'chè đậu xanh']],
    ['Sizzling rice pancake', 'banh-xeo', ['banh xeo', 'bánh xèo']]
]

const api = 'https://commons.wikimedia.org/w/api.php'
const headers = { 'User-Agent': 'WhatDishToCookToday/1.0 (local demo seed)' }

async function search(term) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: `filetype:bitmap ${term}`,
        gsrnamespace: '6',
        gsrlimit: '3',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|mime',
        iiurlwidth: '900'
    })
    const response = await fetch(`${api}?${params}`, { headers })
    if (!response.ok) return null
    const data = await response.json()
    const pages = data.query && data.query.pages ? Object.values(data.query.pages) : []
    for (const page of pages) {
        const info = page.imageinfo && page.imageinfo[0]
        if (!info) continue
        if (!/^image\/(jpeg|png|webp)$/.test(info.mime || '')) continue
        return info
    }
    return null
}

await fs.mkdir(outDir, { recursive: true })
const images = JSON.parse(await fs.readFile(creditsPath, 'utf8'))
const credits = images.dishes

for (const [name, slug, terms] of DISHES) {
    const existing = path.join(outDir, `${slug}.jpg`)
    let hasFile = false
    try {
        await fs.access(existing)
        hasFile = true
    } catch (error) {
        hasFile = false
    }
    let info = null
    let usedTerm = null
    for (const term of terms) {
        info = await search(term)
        if (info) { usedTerm = term; break }
        await new Promise(resolve => setTimeout(resolve, 600))
    }
    if (!info) {
        console.log(`MISS ${slug}`)
        continue
    }
    if (!hasFile) {
        const imageUrl = info.thumburl || info.url
        await new Promise(resolve => setTimeout(resolve, 2000))
        const response = await fetch(imageUrl, { headers })
        if (!response.ok) {
            console.log(`DOWNLOAD-FAIL ${slug} ${response.status}`)
            continue
        }
        const buffer = Buffer.from(await response.arrayBuffer())
        await fs.writeFile(existing, buffer)
        console.log(`OK ${slug} ${buffer.length} bytes`)
    } else {
        console.log(`SKIP-DOWNLOAD ${slug}`)
    }
    const meta = info.extmetadata || {}
    credits[name] = {
        slug,
        term: usedTerm,
        file: `public/pictures/dishes/${slug}.jpg`,
        source: info.descriptionurl,
        license: meta.LicenseShortName ? meta.LicenseShortName.value : 'unknown',
        artist: meta.Artist ? meta.Artist.value.replace(/<[^>]+>/g, '').trim() : 'unknown'
    }
    await new Promise(resolve => setTimeout(resolve, 600))
}

await fs.writeFile(creditsPath, JSON.stringify({ ...images, dishes: credits }, null, 2) + '\n')
console.log(`Wrote ${Object.keys(credits).length} credits to ${creditsPath}`)
