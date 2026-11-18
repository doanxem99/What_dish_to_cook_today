const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('./verifyToken');
const { recordAudit } = require('../../config/admin/audit');

const default_admin_username = function() {
    return process.env.ADMIN_USERNAME || 'moonshine@gmail.com';
};

//Registration, sign-in and password change share one rule: a password is a non-empty string.
const isValidPassword = function(value) {
    return typeof value === 'string' && value.length > 0;
};

const checkDuplicate = async function(req, res, next) {
    try {
        let [username, email] = await Promise.all([
            database.collections.User.findOne({ username: req.body.username }),
            database.collections.User.findOne({ email: req.body.email })
        ]);
        if (username) {
            return res.status(400).send({
                message: "Failed! Username is already in use!"
            });
        }
        if (email) {
            return res.status(400).send({
                message: "Failed! Email is already in use!"
            });
        }
        next();
    } catch (err) {
        return res.status(500).send({
            message: err.toString()
        });
    }
}

const signin = async function(req, res) {
    try {
        if (!req.body.username || !req.body.password) {
            return res.status(400).send({
                message: "User/email and password are required!"
            });
        }
        let user = await database.collections.User.findOne({ $or: [{ username: req.body.username }, { email: req.body.username }] })
        //Same answer for an unknown account and a wrong password, so presence is not discoverable
        if (!user) {
            return res.status(401).send({
                message: "User/email or password is not correct!"
            });
        }
        let passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
        if (!passwordIsValid) {
            return res.status(401).send({
                //Password not valid
                message: "User/email or password is not correct!"
            });
        }
        if (user.is_disabled) {
            return res.status(401).send({
                message: "This account is disabled!"
            });
        }
        let token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: 86400 // 24 hours
        });
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: req.secure, // Only sent over HTTPS when the request is HTTPS
            sameSite: 'lax',
            maxAge: 86400 * 1000
        });

        const roles = await database.collections.Role.find({ _id: { $in: user.roles } });

        //Admin entry is audited at sign-in; the row never carries password material.
        if (roles.some(role => role.name === 'admin')) {
            await recordAudit({
                actorId: user._id,
                actorName: user.username || user.email || '',
                action: 'admin.signin',
                targetType: 'user',
                targetId: user._id,
                result: 'ok',
                detail: 'admin signed in',
                ip: req.ip || ''
            }).catch(() => {});
        }

        return res.status(200).send({
            message: "Login successfully!",
            user: {
                id: user._id,
                username: user.username || user.email,
            },
            roles: roles.map(role => role.name),
            //Users created before the field existed have no flag
            must_change_password: user.must_change_password === true,
        });
    } catch (err) {
        return res.status(500).send({
            message: err.toString()
        });
    }
}

const signup = async function(req, res) {
    try {
        if (!req.body.username || !req.body.email || !isValidPassword(req.body.password)) {
            return res.status(400).send({
                message: "Username, email and password are required!"
            });
        }
        let hashedPassword = bcrypt.hashSync(req.body.password, 10);
        let user = new database.collections.User({
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
            created_at: new Date()
        });
        let role = await database.collections.Role.findOne({ name: "user" });
        if (!role) {
            //The seed does not create roles, so create the default role on first signup
            role = await database.collections.Role.create({ name: "user", description: "User role" });
        }
        user.roles = [role._id];
        await user.save();
        return res.status(200).send({
            message: "User was registered successfully!"
        });
    } catch (err) {
        return res.status(500).send({
            message: err.toString()
        });
    }
}

router.get('/', function(req, res, next){
    next();
});

//Create the roles the server needs and promote the configured account once per boot.
//A missing account is not an error.
const promoteAdmin = async function(username = default_admin_username()) {
    try {
        const roles = {};
        for (const seed of database.default_roles) {
            roles[seed.name] = await database.collections.Role.findOneAndUpdate(
                { name: seed.name },
                { $setOnInsert: seed },
                { new: true, upsert: true }
            );
        }
        const user = await database.collections.User.findOne({
            $or: [{ username: username }, { email: username }]
        });
        if (!user) {
            console.log(`Admin promotion skipped: no account for ${username}.`);
            return false;
        }
        const adminId = roles.admin._id.toString();
        const isAdmin = (user.roles || []).some(id => id.toString() === adminId);
        if (isAdmin) {
            console.log(`${username} is already an admin.`);
            return true;
        }
        user.roles = [...(user.roles || []), roles.admin._id];
        await user.save();
        console.log(`Promoted ${username} to admin.`);
        return true;
    } catch (err) {
        console.error(`Admin promotion failed: ${err.message || err}`);
        return false;
    }
};

router.post('/signin',
    signin);

router.post('/signup', 
    checkDuplicate,
    signup);

router.post('/verifytoken', 
    verifyToken,
    function(req, res){
        //verifyToken already checked the cookie and the user
        return res.status(200).send({
            message: "Token is valid!",
            userid: req.body.userid,
            roles: req.roles,
        });
    }
)

router.post('/password', verifyToken, async function(req, res) {
    try {
        //verifyToken already loaded the account for this token
        const user = req.current_user;
        if (user.is_disabled) {
            return res.status(403).send({ message: "This account is disabled!" });
        }
        if (!isValidPassword(req.body.current_password)
            || !bcrypt.compareSync(req.body.current_password, user.password)) {
            return res.status(400).send({ message: "Current password is not correct!" });
        }
        if (!isValidPassword(req.body.new_password)) {
            return res.status(400).send({ message: "New password is required!" });
        }
        user.password = bcrypt.hashSync(req.body.new_password, 10);
        user.must_change_password = false;
        await user.save();
        return res.status(200).send({ message: "Password updated!" });
    } catch (err) {
        return res.status(500).send({ message: err.toString() });
    }
})

router.get('/me', verifyToken, async function(req, res){
    try {
        const user = await database.collections.User.findOne({ _id: req.body.userid }).populate('roles');
        if (!user) {
            return res.status(404).send({
                message: "User not found!"
            });
        }
        return res.status(200).send({
            message: "User loaded!",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                background_image: user.background_image || '',
                //Users created before the field existed have no joined date
                created_at: user.created_at || null,
                roles: req.roles,
            },
            //The boot re-hydration reads the flag here; older accounts have no field.
            must_change_password: user.must_change_password === true,
        });
    } catch (err) {
        return res.status(500).send({
            message: err.toString()
        });
    }
})

router.post('/background', verifyToken, async function(req, res) {
    try {
        const value = typeof req.body.background_image === 'string' ? req.body.background_image : '';
        if (value && !value.startsWith('public/gallery/')) {
            return res.status(400).send({ message: 'Image must be uploaded first' });
        }
        await database.collections.User.updateOne({ _id: req.body.userid }, { $set: { background_image: value } });
        return res.status(200).send({ message: 'Background updated', background_image: value });
    } catch (err) {
        return res.status(500).send({ message: err.toString() });
    }
})

router.post('/signout', function(req, res){
    res.clearCookie('token');
    return res.status(200).send({
        message: "Logout successfully!"
    });
})

module.exports = router;
module.exports.promoteAdmin = promoteAdmin;
