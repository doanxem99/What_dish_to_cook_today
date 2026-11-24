const express = require('express');
const path = require('path');

//Serves both built clients: Flutter under /flutter, Vue at the root with an SPA fallback.
//API and public files belong to the app and are never rewritten here.
const createStaticSite = function({ vueRoot, flutterRoot }) {
    const router = express.Router();

    router.use('/flutter', express.static(flutterRoot));

    //The Flutter client uses path routing, so a deep link must load its shell for HTML navigations
    router.get(['/flutter', '/flutter/*splat'], function(req, res, next) {
        const requestPath = '/' + req.path.replace(/^\/+/, '');
        if (path.extname(requestPath) !== '' || !req.accepts('html')) {
            return next();
        }
        res.sendFile(path.join(flutterRoot, 'index.html'), err => {
            if (err) {
                next(err);
            }
        });
    });

    //The Flutter build used to live at /web
    router.get(['/web', '/web/*splat'], function(req, res) {
        res.redirect(301, '/flutter/');
    });

    router.use(express.static(vueRoot));

    //Only a browser navigation may receive the app shell; assets that are missing stay 404
    //Express 5 needs a named splat; the braces also match the root path
    router.get('/{*splat}', function(req, res, next) {
        const requestPath = '/' + req.path.replace(/^\/+/, '');
        if (requestPath.startsWith('/api') || requestPath.startsWith('/public')) {
            return next();
        }
        if (path.extname(requestPath) !== '') {
            return next();
        }
        if (!req.accepts('html')) {
            return next();
        }
        res.sendFile(path.join(vueRoot, 'index.html'), err => {
            if (err) {
                next(err);
            }
        });
    });

    return router;
};

module.exports = createStaticSite;
