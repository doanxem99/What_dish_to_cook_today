const express = require('express');
const path = require('path');

//Serves both built clients: Flutter under /flutter, Vue at the root with an SPA fallback.
//API, public files and the worker socket belong to the app and are never rewritten here.
const createStaticSite = function({ vueRoot, flutterRoot }) {
    const router = express.Router();

    router.use('/flutter', express.static(flutterRoot));
    router.get(['/flutter', '/flutter/*'], function(req, res, next) {
        res.sendFile(path.join(flutterRoot, 'index.html'), err => {
            if (err) {
                next(err);
            }
        });
    });

    router.use(express.static(vueRoot));
    router.get('*', function(req, res, next) {
        if (req.path.startsWith('/api') || req.path.startsWith('/public') || req.path.startsWith('/worker')) {
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
