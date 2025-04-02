const mongodb = require('mongodb');
const crypto = require('crypto');  // SHA-256 for hashing

let client;
let db;
let users;
let sessions;
let requests;

// Database Connection (Keep it the Same as You Wanted)
async function connectDatabase() {
    if (!client) {
        client = new mongodb.MongoClient('mongodb+srv://AlMoatasim60300294:QWER.1234@cluster.jlnza.mongodb.net/');
        db = client.db('CMS_db');  // Change database name here
        users = db.collection('Users');  // Collection for user accounts
        session = db.collection('Sessions');  // Collection for session data
        sessions = db.collection('Sessions'); // ✅ FIXED: Added sessions collection
        requests = db.collection('Requests'); // ✅ FIXED: Added requests collection
    }
}

// Function to Hash Passwords using SHA-256
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// User Registration
async function createUser(username, hashedPassword, email, activationCode, userType, isActive) {
    await connectDatabase();
    let user = {
        UserName: username,
        Password: hashedPassword,
        Email: email,
        ActivationCode: activationCode,
        UserType: userType,
        Active: isActive,
        CreatedAt: new Date()
    };

    await users.insertOne(user);
    console.log(`User registered: ${username} (${userType})`);
}

// User Verification
async function verifyUser(email, activationCode) {
    await connectDatabase();
    let user = await users.findOne({ Email: email, ActivationCode: activationCode });

    if (user) {
        await users.updateOne({ Email: email }, { 
            $set: { Active: true }, 
            $unset: { ActivationCode: "" } // ✅ Remove activation code after verification
        });

        console.log(`User ${email} is now verified and active.`);
        return true;
    }
    return false;
}

// Retrieve User Data
async function getUserByUsernameOrEmail(username, email) {
    await connectDatabase();
    return await users.findOne({ $or: [{ UserName: username }, { Email: email }] });
}

async function getUserDetails(username) {
    await connectDatabase();
    return await users.findOne({ UserName: username });
}

async function getUserByEmail(email) {
    await connectDatabase();
    return await users.findOne({ Email: email });
}

// Admin
async function getAllUsers() {
    await connectDatabase();
    return await users.find({}, { projection: { Password: 0 } }).toArray(); // ✅ Hide password field
}

async function activateUser(email) {
    await connectDatabase();
    let result = await users.updateOne({ Email: email }, { $set: { Active: true } });

    if (result.modifiedCount > 0) {
        console.log(`✅ User ${email} activated successfully.`);
        return true;
    } else {
        console.log(`❌ User activation failed for ${email}.`);
        return false;
    }
}

// Standard
async function getStudentCourses(username) {
    await connectDatabase();
    let student = await users.findOne({ UserName: username });

    if (!student) {
        return [];
    }

    return student.Courses || [];
}


// In business.js, modify startSession
async function startSession(data) {
    let uuid = crypto.randomUUID();
    // Make sure data contains both username and UserType
    await persistence.storeSession(uuid, data.username, data.UserType); // Pass the userType to persistence
    return {
        uuid: uuid,
        expiry: new Date(Date.now() + 5 * 60 * 1000)
    };
}

// Session Management - Expires in 5 Minutes
async function storeSession(sessionID, username, userType) {
    await connectDatabase();
    let expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await sessions.insertOne({ sessionID, username, userType, createdAt: new Date(), expiresAt });
}

// Get session (Check if session is valid)
async function getSession(sessionID) {
    await connectDatabase();
    let session = await sessions.findOne({ sessionID });

    if (session) {
        let now = new Date();
        if (now > session.expiresAt) {
            console.log("Session expired. Logging out user.");
            await deleteSession(sessionID);
            return null; // ✅ FIXED: Session expired, return null
        }
        return session;
    }
    return null; // No session found
}

// Delete session (logout)
async function deleteSession(sessionID) {
    await connectDatabase();
    await sessions.deleteOne({ sessionID });
    console.log("Session deleted.");
}

// Request Handling - Submitting a Request
async function submitRequest(username, category, details) {
    await connectDatabase();
    let estimatedTime = await calculateEstimatedTime(category);
    await requests.insertOne({ 
        username, 
        category, 
        details, 
        status: "pending", 
        createdAt: new Date(), 
        estimatedCompletion: estimatedTime 
    });
    console.log("Request submitted:", { username, category, details, estimatedTime });
}

// Fetch All Pending Requests
async function getAllRequests() {
    await connectDatabase();
    return await requests.find({ status: "pending" }).toArray();
}

// Process a Request (Approved/Rejected)
async function processRequest(requestID, action) {
    await connectDatabase();
    await requests.updateOne(
        { _id: new mongodb.ObjectId(requestID) }, 
        { $set: { status: action, processedAt: new Date() } }
    );
    console.log("Request processed:", { requestID, action });
}

// Function to Estimate Processing Time
async function calculateEstimatedTime(category) {
    await connectDatabase();
    let queueSize = await requests.countDocuments({ category, status: "pending" });
    let processingTimePerRequest = 15; // Assume 15 minutes per request
    let estimatedCompletionTime = new Date(Date.now() + queueSize * processingTimePerRequest * 60000);
    return estimatedCompletionTime;
}

// Export All Functions
module.exports = {
    getUserDetails,
    storeSession,
    startSession,
    getSession,
    deleteSession,
    createUser,
    verifyUser,
    getUserByEmail,
    getUserByUsernameOrEmail,
    submitRequest,
    getAllRequests,
    processRequest,
    getAllUsers,
    activateUser,
    getStudentCourses
};
