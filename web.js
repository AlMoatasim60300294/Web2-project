const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const business = require('./business.js');
const PORT = 8000;
const app = express();
const handlebars = require('express-handlebars');

app.set('views', __dirname + "/templates");
app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars.engine());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Login Page
app.get('/', (req, res) => {
    res.render('login', { layout: undefined, message: req.query.message })
});

// Handle login and role-based redirection
app.post('/', async (req, res) => {
    let { username, password } = req.body;

    if (!username || !password) {
        return res.redirect("/?message=Invalid Username/Password");
    }

    // Check login
    let loginStatus = await business.checkLogin(username, password);
    if (!loginStatus) {
        return res.redirect("/?message=Invalid Username/Password");
    }

    if (loginStatus === "inactive") {
        return res.redirect("/?message=Please verify your email before logging in");
    }

    // 🔧 Assign userType based on username
    let userType = (username === "admin") ? "admin" : "student";

    // Start session
    let session = await business.startSession({ username, userType });

    res.cookie('CMS_Session', session.uuid, { expires: session.expiry });

    // 🔁 Redirect
    res.redirect(userType === "admin" ? "/admin" : "/dashboard");
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
        req.userType = sessionData.userType;
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
    if (!sessionData || sessionData.userType !== "admin") {
        return res.redirect("/?message=Unauthorized");
    }

    let users = await business.getAllUsers(); // ✅ Fetch users from DB
    res.render("admin_dashboard", { username: sessionData.username, users });
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
    if (!sessionData || sessionData.userType !== "student") {
        return res.redirect("/?message=Unauthorized");
    }

    let courses = await business.getStudentCourses(sessionData.username); // ✅ Fetch courses
    res.render("standard_dashboard", { username: sessionData.username, courses });
});

// request for the user 
app.post('/submit-request', async (req, res) => {
    if (!req.user || req.userType !== "student") {
        return res.redirect("/?message=Unauthorized");
    }

    const { category, details } = req.body;

    if (!category || !details) {
        return res.redirect('/dashboard?message=All fields are required');
    }

    await business.submitRequest({
        username: req.user,
        category,
        details
    });

    res.redirect('/dashboard?message=Request submitted successfully');
});

// Register
app.get('/register', (req, res) => {
    res.render('register', { layout: undefined, message: req.query.message });
});

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

app.get('/verify', (req, res) => {
    res.render('verify', { layout: undefined, message: req.query.message });
});

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
    let sessionKey = req.cookies.CMS_Session;

    if (sessionKey) {
        await business.deleteSession(sessionKey);
        res.clearCookie('CMS_Session');
    }

    res.redirect('/?message=Logged out successfully');
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://127.0.0.1:${PORT}/`));
