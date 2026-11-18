const express = require('express');
const router = express.Router();

//Liveness only: the container healthcheck and the Compose healthcheck read this.
//No counts, no latency and no user data belong here.
router.get('/', function(req, res) {
    res.status(200).send({
        status: 'ok',
        uptime_s: Math.round(process.uptime())
    });
});

module.exports = router;
