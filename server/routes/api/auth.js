const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { stat } = require('fs-extra');
const { verifyToken } = require('./verifyToken');

const checkDuplicate = async function(req, res, next) {
    try {
        console.log(req);
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
        let user = await database.collections.User.findOne({ $or: [{ username: req.body.username }, { email: req.body.username }] })
        if (!user) {
            return res.status(404).send({
                //User not found
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
        let token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: 86400 // 24 hours
        });
        
        res.cookie('token', token, {
            httpOnly: true,
            // secure: false, // Set to true if using HTTPS
            sameSite: 'lax'
        });

        return res.status(200).send({
            message: "Login successfully!",
            user: {
                username: user.username || user.email,
            },
            token: token,
        });
    } catch (err) {
        return res.status(500).send({
            message: err.toString()
        });
    }
}

const signup = async function(req, res) {
    try {
        console.log(req);
        let hashedPassword = bcrypt.hashSync(req.body.password, 10);
        let user = new database.collections.User({
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword
        });
        let role = await database.collections.Role.findOne({ name: "user" });
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

router.post('/signin',
    signin);

router.post('/signup', 
    checkDuplicate,
    signup);

router.post('/verifytoken', 
    verifyToken
)

module.exports = router;