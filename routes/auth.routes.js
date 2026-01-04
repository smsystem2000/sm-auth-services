const express = require("express");
const router = express.Router();

const { login, schoolLogin, verifyToken, createAdmin } = require("../controllers/auth.controller");
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");

// Public routes (no authentication required)
router.post("/login", login);
router.post("/school-login", schoolLogin);

module.exports = router;

