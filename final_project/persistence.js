const mongodb = require('mongodb');
const { ObjectId } = require('mongodb');


let client;
let db;
let users;
let sessions;
let requests;

// Database Connection (Keep it the Same as You Wanted)
async function connectDatabase() {
    if (!client) {
        client = new mongodb.MongoClient('mongodb+srv://Abdalwahab:12class34@cluster0.lx4i2.mongodb.net/');
        db = client.db('CMS_db');  // database name
        users = db.collection('Users');  // Collection for user accounts
        sessions = db.collection('Sessions');  // Collection for session data        
        requests = db.collection('Requests');  // Collection for requests data
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

async function getRequestsByUser(username, semester) {
    await connectDatabase();
    return await requests.find({ username, semester }).toArray();
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
            return null; 
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

async function saveRequest(requestUser) {
    await connectDatabase();

    const { username, category, details } = requestUser;

    // Step 1: Count current requests in same category with status = "Pending"
    const queueSize = await requests.countDocuments({ category, status: "Pending" });

    // Step 2: Estimate time: 15 mins per request
    const estimatedTime = new Date(Date.now() + queueSize * 15 * 60 * 1000);

    // Step 3: Save full request object
    await requests.insertOne({
        username,
        category,
        details,
        semester: "Winter 2025", // hardcoded for now
        status: "Pending",
        submittedAt: new Date(),
        estimatedCompletion: estimatedTime
    });
    

    console.log(`New request submitted by ${username} in ${category} queue`);
}

async function cancelRequest(requestId, username) {
    await connectDatabase();

    const result = await requests.updateOne(
        { _id: new ObjectId(requestId), username, status: "Pending" },
        { $set: { status: "Cancelled", cancelledAt: new Date() } }
    );

    return result.modifiedCount > 0;
};

async function getAllRequests() {
    await connectDatabase();
    return await requests.find({}).toArray();
}

async function getRequestsByCategory(category) {
    await connectDatabase();
    return await requests.find({ category }).toArray();
}

async function getRequestById(id) {
    await connectDatabase();
    return await requests.findOne({ _id: new ObjectId(id) });
}

async function processRequest(id, status, note) {
    await connectDatabase();
    return await requests.updateOne(
        { _id: new ObjectId(id), status: "Pending" },
        {
            $set: {
                status,
                processedAt: new Date(),
                note
            }
        }
    );
}

async function getRandomPendingRequest() {
    await connectDatabase();
    const pending = await requests.aggregate([
        { $match: { status: "Pending" } },
        { $sample: { size: 1 } } // MongoDB random sample
    ]).toArray();

    return pending[0]; // or undefined if none
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
    getStudentCourses,
    getRequestsByUser,
    saveRequest,
    cancelRequest,
    getAllRequests,
    getRequestsByCategory,
    getRequestById,
    processRequest,
    getRandomPendingRequest
};
