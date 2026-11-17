const express = require('express');
const router = express.Router();
const profileEnum = require('../../config/enum/profile_enum');

//Optional translation proxy. Point TRANSLATE_URL at a LibreTranslate-compatible
//endpoint (for example a self-hosted instance); without it the UI keeps translation off.
router.post('/', async function(req, res) {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const source = req.body.source === 'vi' ? 'vi' : 'en';
    const target = req.body.target === 'vi' ? 'vi' : 'en';

    if (!text) {
        return res.status(400).send({ message: "Text is required" });
    }
    if (text.length > 2000) {
        return res.status(400).send({ message: "Text is too long" });
    }
    if (source === target) {
        return res.status(200).send({ text });
    }

    const endpoint = process.env.TRANSLATE_URL;
    if (!endpoint) {
        return res.status(503).send({
            message: "Translation is not configured. Set TRANSLATE_URL to a LibreTranslate endpoint."
        });
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ q: text, source: source, target: target, format: 'text' })
        });
        if (!response.ok) {
            return res.status(502).send({ message: "Translation service answered " + response.status });
        }
        const data = await response.json();
        const translated = data && typeof data.translatedText === 'string' ? data.translatedText : '';
        if (!translated) {
            return res.status(502).send({ message: "Translation service returned no text" });
        }
        return res.status(200).send({ text: translated });
    } catch (err) {
        return res.status(502).send({ message: "Translation failed: " + err.message });
    }
});

module.exports = router;
