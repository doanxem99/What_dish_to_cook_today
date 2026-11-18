const { verifyToken } = require('../../routes/api/verifyToken');

//A demotion is allowed only while another admin remains.
const canDemoteAdmin = function(adminCount) {
    return adminCount > 1;
};

const requireAdmin = function(req, res, next) {
    verifyToken(req, res, function() {
        //verifyToken rejected a missing cookie, a bad token and a deleted user
        const user = req.current_user;
        if (user.is_disabled) {
            return res.status(403).send({ message: "This account is disabled!" });
        }
        if (!Array.isArray(req.roles) || !req.roles.includes('admin')) {
            return res.status(403).send({ message: "Admin role required!" });
        }
        return next();
    });
};

module.exports = { requireAdmin, canDemoteAdmin };
