const persistence = require("./persistence.js");
const crypto = require("crypto");

// Check user login with SHA-256 hashing
async function checkLogin(username, password) {
    console.log(`Attempting login for username: ${username}`);
    let details = await persistence.verifyUser(username, password);

    if (!details) {
        console.log('Invalid credentials');
        return undefined;
    }

    console.log(`Login successful, user type: ${details.UserType}`);
    return details.UserType;
}

// Create a new user
async function createUser(username, password, email, userType = "student") {
    let existingUser = await persistence.getUserByUsernameOrEmail(username, email);

    if (existingUser) {
        return { success: false, message: "Username or email already exists" };
    }

    let hash = crypto.createHash('sha256');
    hash.update(password);
    let hashedPassword = hash.digest('hex');

    // Set isActive to true by default
    await persistence.createUser(username, hashedPassword, email, null, userType, true);

    return { success: true };
}

// Request Management
async function submitRequest(username, category, details) {
    const requestData = {
        username,
        category,
        details,
        semester: getCurrentSemester(),
        status: 'pending',
        createdAt: new Date()
    };
    
    const result = await persistence.submitRequest(requestData);
    console.log(`Email notification: New request submitted by ${username}`);
    console.log(`Request details: Category - ${category}, Semester - ${getCurrentSemester()}`);
    return result;
}

async function getUserRequests(username, semester = 'all') {
    const requests = await persistence.getUserRequests(username);
    if (semester === 'all') {
        return requests;
    }
    return requests.filter(req => req.semester === semester);
}

async function getAvailableSemesters(username) {
    const requests = await persistence.getUserRequests(username);
    const semesters = new Set(requests.map(req => req.semester));
    const currentSem = getCurrentSemester();
    semesters.add(currentSem);
    return Array.from(semesters).sort().reverse();
}

function getCurrentSemester() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    if (month >= 8) return `Fall ${year}`;
    if (month >= 5) return `Summer ${year}`;
    return `Spring ${year}`;
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

async function getUserByEmail(email) {
    return await persistence.getUserByEmail(email);
}

const { readData, writeData } = require('./persistence');

async function getAllRequests() {
    return await persistence.getAllRequests();
}

async function getRequestById(id) {
    return await persistence.getRequestById(id);
}

async function updateRequestStatus(id, status, note) {
    const updated = await persistence.updateRequestStatus(id, status, note);
    console.log(`Email notification: Request ${id} has been ${status}`);
    return updated;
}

async function getQueueStats() {
    const allRequests = await persistence.getAllRequests();
    return {
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'pending').length,
        approved: allRequests.filter(r => r.status === 'approved').length,
        rejected: allRequests.filter(r => r.status === 'rejected').length
    };
}

async function getRandomPendingRequest() {
    const allRequests = await persistence.getAllRequests();
    const pending = allRequests.filter(r => r.status === 'pending');
    return pending.length > 0 ? pending[Math.floor(Math.random() * pending.length)] : null;
}

module.exports = {
    checkLogin,
    createUser,
    startSession,
    getSessionData,
    deleteSession,
    getUserByEmail,
    getAllUsers,
    activateUser,
    getStudentCourses,
    submitRequest,
    getUserRequests,
    getAvailableSemesters,
    getCurrentSemester,
    getAllRequests,
    getRequestById,
    updateRequestStatus,
    getQueueStats,
    getRandomPendingRequest
};