const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const business = require('./business.js');

const app = express();
const handlebars = require('express-handlebars');

app.set('views', __dirname + "/templates");
app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars.engine());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Login Page
app.get('/', (req, res) => res.render('login', { layout: undefined, message: req.query.message }));

// Modify your login POST route in web.js
app.post('/', async (req, res) => {
    let { username, password } = req.body;

    if (!username || !password) {
        res.redirect("/?message=Invalid Username/Password");
        return;
    }

    let userType = await business.checkLogin(username, password);
    if (!userType) {
        res.redirect("/?message=Invalid Username/Password");
        return;
    }

    if (userType === "inactive") {
        res.redirect("/?message=Please verify your email before logging in");
        return;
    }

    // Start a session with both username and userType
    let session = await business.startSession({ username, UserType: userType });

    res.cookie('CMS_Session', session.uuid, { expires: session.expiry });
    
    // Redirect based on user type
    if (userType === "admin") {
        res.redirect('/admin');
    } else if (userType === "student") {
        res.redirect('/dashboard');
    } else {
        res.redirect('/course-management'); // Default fallback
    }
});

// Middleware to check session
app.use(async (req, res, next) => {
    let sessionID = req.cookies.CMS_Session;
    if (!sessionID) {
        return next();
    }
    
    let sessionData = await business.getSessionData(sessionID);
    if (sessionData) {
        // Make sure we're using the correct property names
        req.user = sessionData.username; // Match the property name used in startSession
        req.userType = sessionData.UserType;
    }
    next();
});

// Admin
app.get('/admin', async (req, res) => {
    let sessionKey = req.cookies.CMS_Session;
    if (!sessionKey) {
        return res.redirect("/?message=Not logged in");
    }

    let sessionData = await business.getSessionData(sessionKey);
    if (!sessionData || sessionData.UserType !== "admin") {
        return res.redirect("/?message=Unauthorized");
    }

    let users = await business.getAllUsers(); // ✅ Fetch users from DB
    res.render("admin_dashboard", { username: sessionData.UserName, users });
});


// ✅ Route to Activate Users
app.post('/admin/activate', async (req, res) => {
    if (!req.user || req.userType !== "admin") {
        return res.redirect("/?message=Unauthorized");
    }

    let { email } = req.body;
    await business.activateUser(email); // ✅ Activate user
    res.redirect("/admin");
});

//Standard user 
app.get('/dashboard', async (req, res) => {
    let sessionKey = req.cookies.CMS_Session;
    if (!sessionKey) {
        return res.redirect("/?message=Not logged in");
    }

    let sessionData = await business.getSessionData(sessionKey);
    if (!sessionData || sessionData.UserType !== "student") {
        return res.redirect("/?message=Unauthorized");
    }

    let courses = await business.getStudentCourses(sessionData.UserName); // ✅ Fetch courses
    res.render("standard_dashboard", { username: sessionData.UserName, courses });
});


// Course Management Access
app.get('/course-management', async (req, res) => {
    let sessionKey = req.cookies.CMS_Session; // ✅ Changed from "lab7session"
    if (!sessionKey) {
        res.redirect("/?message=Not logged in");
        return;
    }

    let sessionData = await business.getSessionData(sessionKey);
    if (!sessionData) {
        res.redirect("/?message=Not logged in");
        return;
    }

    res.render('course_management', { layout: undefined, username: sessionData.UserName });
});

// Register
app.get('/register', (req, res) => res.render('register', { layout: undefined, message: req.query.message }));

app.post('/register', async (req, res) => {
    let { username, email, password, repeatPassword } = req.body;

    if (!username || !email || !password || !repeatPassword) {
        res.redirect('/register?message=All fields are required');
        return;
    }

    if (password !== repeatPassword) {
        res.redirect('/register?message=Passwords do not match');
        return;
    }

    let result = await business.createUser(username, password, email);
    if (!result.success) {
        res.redirect('/register?message=' + encodeURIComponent(result.message));
        return;
    }

    res.redirect('/?message=Check console for activation code');
});

// Verification
app.get('/verify', (req, res) => res.render('verify', { layout: undefined }));

app.post('/verify', async (req, res) => {
    let { email, activationCode } = req.body;
    let success = await business.verifyUser(email, activationCode);
    res.redirect(success ? '/?message=Account activated successfully' : '/verify?message=Invalid activation code');
});

// Forgot Password (GET)
app.get('/forgot-password', (req, res) => res.render('forgot-password', { layout: undefined, message: req.query.message }));

// Forgot Password (POST)
app.post('/forgot-password', async (req, res) => {
    let { email } = req.body;

    if (!email) {
        res.redirect('/forgot-password?message=Please enter your email');
        return;
    }

    let user = await business.getUserByEmail(email);
    if (!user) {
        res.redirect('/forgot-password?message=This email is not registered');
        return;
    }

    console.log(`Password reset requested for ${email}`);
    res.redirect('/forgot-password?message=A password reset email has been sent');
});

// Logout
app.get('/logout', async (req, res) => {
    let sessionKey = req.cookies.CMS_Session; // ✅ Changed from "lab7session"

    if (sessionKey) {
        await business.deleteSession(sessionKey);
        res.clearCookie('CMS_Session'); // ✅ Changed from "lab7session"
    }

    res.redirect('/?message=Logged out successfully');
});

// ✅ FIXED: Submit Request
app.post("/submit-request", async (req, res) => {
    if (!req.user) {
        return res.redirect("/?message=Not logged in");
    }

    await business.submitRequest(req.user, req.body.category, req.body.details); // ✅ FIXED: Use business layer
    res.redirect("/course-management");
});

// ✅ FIXED: HoD Request View
app.get("/hod/requests", async (req, res) => {
    if (!req.user || req.userType !== "hod") {
        return res.redirect("/?message=Unauthorized");
    }

    let requests = await business.getAllRequests(); // ✅ FIXED: Use business layer
    res.render("hod-requests", { requests });
});

// ✅ FIXED: HoD Process Request
app.post("/hod/process", async (req, res) => {
    if (!req.user || req.userType !== "hod") {
        return res.redirect("/?message=Unauthorized");
    }

    await business.processRequest(req.body.requestID, req.body.action); // ✅ FIXED: Use business layer
    res.redirect("/hod/requests");
});

// Start Server
app.listen(8000, () => console.log("Server running at http://127.0.0.1:8000/"));
