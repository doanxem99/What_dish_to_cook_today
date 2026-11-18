//express.json answers a malformed body with a plain-text SyntaxError page.
//The API documents one JSON error envelope, so translate only that case.
const bodyError = function(err, req, res, next) {
    if (err && err.type === 'entity.parse.failed' && req.path.startsWith('/api/') && !res.headersSent) {
        return res.status(400).send({
            error: { code: 'invalid_json', message: 'Request body is not valid JSON' }
        });
    }
    return next(err);
};

module.exports = bodyError;
