const database = require('../../config/database/connection');
const jwt = require('jsonwebtoken');
const profile_enum = require('../../config/enum/profile_enum');

const verifyToken = async function (req, res, next) {
    // Use req.cookies (plural) instead of req.cookie
    const token = req.cookies.token;

    if (!token) {
        return res.status(profile_enum.Status_Code_Website.Unauthorized).send({
            message: "Authentication invalid!"
        });
    }
    
    try {
        // Use await with a Promise wrapper for jwt.verify
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) reject(err);
                else resolve(decoded);
            });
        });
        // Set userId from decoded token
        req.body.userid = decoded.id;
        
        // Get user and roles
        const user = await database.collections.User.findOne({ _id: req.body.userid }).populate('roles');
        if (!user) {
            //A valid token for a deleted user is not a usable identity
            return res.status(profile_enum.Status_Code_Website.Unauthorized).send({
                message: "User not found!"
            });
        }
        //A disabled account keeps a valid token; reject it here so the ban does not wait for expiry.
        if (user.is_disabled === true) {
            return res.status(profile_enum.Status_Code_Website.Unauthorized).send({
                message: "This account is disabled!"
            });
        }
        //Hand the loaded user to later middleware without a second query
        req.current_user = user;
        
        const roles = await database.collections.Role.find({ _id: { $in: user.roles } });
        req.roles = roles.map(role => role.name);
        
        // Continue to the next middleware or route handler
        next();
    } catch (err) {
        return res.status(profile_enum.Status_Code_Website.Unauthorized).send({
            message: "There was a problem to authorize this request!"
        });
    }
}

module.exports = { verifyToken };