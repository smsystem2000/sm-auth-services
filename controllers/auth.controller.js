const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.model");
const School = require("../models/schools.model");
const { getSchoolDbConnection } = require("../configs/db");

// Schema imports for school database queries
const teacherSchema = require("../schemas/teacher.schema");
const studentSchema = require("../schemas/student.schema");
const parentSchema = require("../schemas/parent.schema");

// Admin Login
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required",
            });
        }

        // Find admin by username
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password",
            });
        }

        // Compare password (plain text for now)
        if (password !== admin.password) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password",
            });
        }

        // Generate JWT token with adminId, username, role
        const token = jwt.sign(
            {
                adminId: admin.adminId,
                username: admin.username,
                role: admin.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token,
                admin: {
                    adminId: admin.adminId,
                    username: admin.username,
                    role: admin.role,
                },
            },
        });
    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({
            success: false,
            message: "Error during login",
            error: error.message,
        });
    }
};

// School Login - For teachers, students, and parents
const schoolLogin = async (req, res) => {
    try {
        const { email, password, role, schoolId } = req.body;

        // Validate input
        if (!email || !password || !role || !schoolId) {
            return res.status(400).json({
                success: false,
                message: "email, password, role, and schoolId are required",
            });
        }

        // Validate role
        const validRoles = ["teacher", "student", "parent", "sch_admin"];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
            });
        }

        // Find school to get database name
        const school = await School.findOne({ schoolId });
        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found",
            });
        }

        if (school.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "This school is currently inactive",
            });
        }

        // For sch_admin, use the User model from SuperAdmin database
        // For others, use school-specific database
        let Model;
        let idField;

        if (role === "sch_admin") {
            // sch_admin is stored in SuperAdmin database's Users collection
            const User = require("../models/users.model");
            Model = User;
            idField = "userId";
        } else {
            // Get school-specific database connection
            const schoolDb = getSchoolDbConnection(school.schoolDbName);

            switch (role) {
                case "teacher":
                    Model = schoolDb.model("Teacher", teacherSchema);
                    idField = "teacherId";
                    break;
                case "student":
                    Model = schoolDb.model("Student", studentSchema);
                    idField = "studentId";
                    break;
                case "parent":
                    Model = schoolDb.model("Parent", parentSchema);
                    idField = "parentId";
                    break;
            }
        }

        // Find user by email
        const user = await Model.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Check if user is active
        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your account is currently inactive",
            });
        }

        // Compare password (plain text for now)
        if (password !== user.password) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Generate JWT token with user details
        const token = jwt.sign(
            {
                userId: user[idField],
                email: user.email,
                role: user.role,
                schoolId: schoolId,
                schoolDbName: school.schoolDbName,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token,
                user: {
                    userId: user[idField],
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role,
                    schoolId: schoolId,
                },
            },
        });
    } catch (error) {
        console.error("Error during school login:", error);
        return res.status(500).json({
            success: false,
            message: "Error during login",
            error: error.message,
        });
    }
};

// Verify Token (optional - for checking token validity)
const verifyToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "No token provided",
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        return res.status(200).json({
            success: true,
            message: "Token is valid",
            data: {
                userId: decoded.userId || decoded.adminId,
                email: decoded.email || decoded.username,
                role: decoded.role,
                schoolId: decoded.schoolId,
            },
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};

// Helper function to generate adminId
const generateAdminId = async () => {
    const lastAdmin = await Admin.findOne().sort({ adminId: -1 });

    if (!lastAdmin || !lastAdmin.adminId) {
        return "ADM00001";
    }

    const lastIdNumber = parseInt(lastAdmin.adminId.replace("ADM", ""), 10);
    const newIdNumber = lastIdNumber + 1;

    return `ADM${String(newIdNumber).padStart(5, "0")}`;
};

// Create Admin
const createAdmin = async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required",
            });
        }

        // Check if username already exists
        const existingAdmin = await Admin.findOne({ username });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: "Username already exists",
            });
        }

        // Generate adminId
        const adminId = await generateAdminId();

        // Store password (plain text for now - add bcrypt later for production)
        const newAdmin = new Admin({
            adminId,
            username,
            password,
            role: role || "super_admin",
        });

        const savedAdmin = await newAdmin.save();

        return res.status(201).json({
            success: true,
            message: "Admin created successfully",
            data: {
                adminId: savedAdmin.adminId,
                username: savedAdmin.username,
                role: savedAdmin.role,
            },
        });
    } catch (error) {
        console.error("Error creating admin:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating admin",
            error: error.message,
        });
    }
};

module.exports = {
    login,
    schoolLogin,
    verifyToken,
    createAdmin,
};

