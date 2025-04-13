const mongodb = require('mongodb');

let client;
let db;
let users;
let sessions;

// Database Connection (Keep it the Same as You Wanted)
async function connectDatabase() {
    if (!client) {
        client = new mongodb.MongoClient('mongodb+srv://AlMoatasim60300294:QWER.1234@cluster.jlnza.mongodb.net/');
        db = client.db('CMS_db');  // database name
        users = db.collection('Users');  // Collection for user accounts
        sessions = db.collection('Sessions');  // Collection for session data        
    }
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
        console.log(`User ${email} activated successfully.`);
        return true;
    } else {
        console.log(`User activation failed for ${email}.`);
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
// Export All Functions
module.exports = {
    getUserDetails,
    storeSession,
    getSession,
    deleteSession,
    createUser,
    verifyUser,
    getUserByEmail,
    getUserByUsernameOrEmail,
    getAllUsers,
    activateUser,
    getStudentCourses
};
