const adminModel = require("../models/admin.model");
const menuModel = require("../models/menu.model");
const usersModel = require("../models/users.model");


const getMenus = async (req, res) => {
    try {
        const { role } = req.params;

        if (!role) {
            return res.status(400).json({
                success: false,
                message: "Role is required to fetch menus",
            });
        }

        const user = await usersModel.findOne({ role });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Match menus either by role or explicit username in the access list
        const accessTokens = [user.role].filter(Boolean);

        const menus = await menuModel.find({
            menuAccessRoles: { $in: accessTokens },
        }, { menuAccessRoles: 0 }).sort({ menuOrder: 1 });

        return res.status(200).json({
            success: true,
            message: "Menus fetched successfully",
            data: menus,
            count: menus.length,
        });
    } catch (error) {
        console.error("Error fetching menus:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch menus",
            error: error.message,
        });
    }
}

module.exports = {     
    getMenus,
}