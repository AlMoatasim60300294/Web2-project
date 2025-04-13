const persistence = require("./persistence.js");
const crypto = require("crypto");

// Check user login with SHA-256 hashing
async function checkLogin(username, password) {
    let details = await persistence.getUserDetails(username);

    if (!details) {
        return undefined;
    }

    // Hash the input password for comparison
    let hash = crypto.createHash('sha256');
    hash.update(password);
    let hashedPassword = hash.digest('hex');

    // Compare stored password hash with the computed hash
    if (details.Password !== hashedPassword) {
        return undefined;
    }

    // Check if user is active (verified)
    if (!details.Active) {
        return "inactive";
    }
    
    return details.UserType;  // Return user role
}

// Create a new user
async function createUser(username, password, email, userType = "student") {
    let existingUser = await persistence.getUserByUsernameOrEmail(username, email);

    if (existingUser) {
        return { success: false, message: "Username or email already exists" };
    }

    let activationCode = userType === "admin" ? null : crypto.randomUUID(); // ✅ Admins don’t need activation codes

    let hash = crypto.createHash('sha256');
    hash.update(password);
    let hashedPassword = hash.digest('hex');

    let isActive = userType === "admin" ? true : false; // ✅ Admins are automatically active

    await persistence.createUser(username, hashedPassword, email, activationCode, userType, isActive);

    console.log(`Activation code for ${email}: ${activationCode}`);

    return { success: true, activationCode };
}

// Verify a user using email and activation code
async function verifyUser(email, activationCode) {
    return await persistence.verifyUser(email, activationCode);
}

// Get user by email
async function getUserByEmail(email) {
    return await persistence.getUserByEmail(email);
}

// admin
async function getAllUsers() {
    return await persistence.getAllUsers();
}
async function activateUser(email) {
    return await persistence.activateUser(email);
}

// standard
async function getStudentCourses(username) {
    return await persistence.getStudentCourses(username);
}

// Start a session for the user (5-minute expiration)
async function startSession(data) {
    let uuid = crypto.randomUUID();
    // Make sure data contains both username and UserType
    await persistence.storeSession(uuid, data.username, data.UserType); // Pass the userType to persistence
    return {
        uuid: uuid,
        expiry: new Date(Date.now() + 5 * 60 * 1000)
    };
}

// Retrieve session data
async function getSessionData(key) {
    return await persistence.getSession(key);
}

// Delete session (logout)
async function deleteSession(key) {
    await persistence.deleteSession(key);
}

module.exports = {
    checkLogin,
    createUser,
    startSession,
    getSessionData,
    deleteSession,
    verifyUser,
    getUserByEmail,
    getAllUsers,
    activateUser,
    getStudentCourses
};
