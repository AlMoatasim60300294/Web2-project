const mongodb = require('mongodb');
const crypto = require('crypto');  // SHA-256 for hashing

let client;
let db;
let users;
let sessions;
let requests;

// Database Connection



async function connectDatabase() {
    try {
        if (!client) {
            client = new mongodb.MongoClient('mongodb+srv://Abdalwahab:12class34@cluster0.lx4i2.mongodb.net/');
            await client.connect();
            console.log('Connected to MongoDB');
            
            // Fix: Use CMS_db instead of Cms_db to match existing database case
            db = client.db('CMS_db');
            users = db.collection('Users');
            sessions = db.collection('Sessions');
            requests = db.collection('Requests');
        }
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
}

// User Management Functions
async function createUser(username, password, email, activationCode, userType = 'student', isActive = false) {
    try {
        await connectDatabase();
        // Password is already hashed in business layer
        const user = {
            UserName: username,
            Password: password,  // Already hashed in business layer
            Email: email,
            ActivationCode: activationCode,
            UserType: userType,
            Active: isActive,
            CreatedAt: new Date(),
            courses: []
        };
        return await users.insertOne(user);
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

async function verifyUser(username, password) {
    try {
        await connectDatabase();
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        return await users.findOne({
            UserName: username,
            Password: hashedPassword,
            Active: true
        });
    } catch (error) {
        console.error('Error verifying user:', error);
        throw error;
    }
}

async function getUserDetails(username, includePassword = false) {
    try {
        await connectDatabase();
        const projection = includePassword ? {} : { projection: { Password: 0 } };
        return await users.findOne(
            { UserName: username },
            projection
        );
    } catch (error) {
        console.error('Error getting user details:', error);
        throw error;
    }
}

async function getUserByEmail(email) {
    try {
        await connectDatabase();
        return await users.findOne({ Email: email });
    } catch (error) {
        console.error('Error getting user by email:', error);
        throw error;
    }
}

async function getUserByUsernameOrEmail(identifier) {
    try {
        await connectDatabase();
        return await users.findOne({
            $or: [
                { UserName: identifier },
                { Email: identifier }
            ]
        });
    } catch (error) {
        console.error('Error getting user by username/email:', error);
        throw error;
    }
}

async function getAllUsers() {
    try {
        await connectDatabase();
        return await users.find({}, { projection: { Password: 0 } }).toArray();
    } catch (error) {
        console.error('Error getting all users:', error);
        throw error;
    }
}

async function activateUser(userId) {
    try {
        await connectDatabase();
        return await users.updateOne(
            { _id: new mongodb.ObjectId(userId) },
            { $set: { Active: true } }
        );
    } catch (error) {
        console.error('Error activating user:', error);
        throw error;
    }
}

// Session Management Functions
async function startSession(username, userType) {
    try {
        const sessionID = crypto.randomUUID();
        await storeSession(sessionID, username, userType);
        return {
            sessionID,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };
    } catch (error) {
        console.error('Error starting session:', error);
        throw error;
    }
}

async function storeSession(sessionID, username, userType) {
    try {
        await connectDatabase();
        const session = {
            sessionID,
            username,
            userType,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
        return await sessions.insertOne(session);
    } catch (error) {
        console.error('Error storing session:', error);
        throw error;
    }
}

async function getSession(sessionID) {
    try {
        await connectDatabase();
        const session = await sessions.findOne({ sessionID });
        if (!session) return null;
        
        if (new Date() > session.expiresAt) {
            await deleteSession(sessionID);
            return null;
        }
        return session;
    } catch (error) {
        console.error('Error getting session:', error);
        throw error;
    }
}

async function deleteSession(sessionID) {
    try {
        await connectDatabase();
        return await sessions.deleteOne({ sessionID });
    } catch (error) {
        console.error('Error deleting session:', error);
        throw error;
    }
}

// Request Management Functions
async function submitRequest(requestData) {
    try {
        await connectDatabase();
        const result = await requests.insertOne(requestData);
        
        // Log email simulation
        console.log(`[Email Sent] To: ${requestData.username}`);
        console.log(`Subject: Request Submitted - ${requestData.category}`);
        console.log(`Body: Your ${requestData.category} request has been submitted and is pending review.`);
        
        return result;
    } catch (error) {
        console.error('Error submitting request:', error);
        throw error;
    }
}

async function getAllRequests() {
    try {
        await connectDatabase();
        return await requests.find({}).toArray();
    } catch (error) {
        console.error('Error getting all requests:', error);
        throw error;
    }
}

async function processRequest(requestId, status) {
    try {
        await connectDatabase();
        return await requests.updateOne(
            { _id: new mongodb.ObjectId(requestId) },
            { $set: { status: status, processedAt: new Date() } }
        );
    } catch (error) {
        console.error('Error processing request:', error);
        throw error;
    }
}

async function getUserRequests(username) {
    try {
        await connectDatabase();
        return await requests.find({ username })
            .sort({ createdAt: -1 })
            .toArray();
    } catch (error) {
        console.error('Error getting user requests:', error);
        throw error;
    }
}

// Course Management Functions
async function getStudentCourses(username) {
    try {
        await connectDatabase();
        const user = await users.findOne({ UserName: username });
        return user?.courses || [];
    } catch (error) {
        console.error('Error getting student courses:', error);
        throw error;
    }
}

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
    getStudentCourses,
    getUserRequests
};