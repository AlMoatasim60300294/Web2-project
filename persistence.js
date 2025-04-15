const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const handlebars = require('express-handlebars');
const crypto = require('crypto');
const business = require('./business.js');

const app = express();
const PORT = 8000;

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Handlebars setup
app.set('views', path.join(__dirname, 'templates'));
app.engine('hbs', handlebars.engine({
  extname: '.hbs',
  layoutsDir: path.join(__dirname, 'templates/layouts'),
  defaultLayout: 'main',
  helpers: {
    eq: (a, b) => a === b,
    formatDate: date => new Date(date).toLocaleDateString(),
    statusColor: status => {
      switch (status) {
        case 'pending': return 'warning';
        case 'approved': return 'success';
        case 'rejected': return 'danger';
        default: return 'secondary';
      }
    }
  }
}));
app.set('view engine', 'hbs');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// ------------------------------
// Session Middleware (Global)
// ------------------------------
app.use(async (req, res, next) => {
  const sessionID = req.cookies.CMS_Session;
  if (sessionID) {
    const sessionData = await business.getSessionData(sessionID);
    if (sessionData) {
      req.user = sessionData.username;
      req.userType = sessionData.userType;
    }
  }
  next();
});

// ------------------------------
// Routes
// ------------------------------

// Login
app.get('/', (req, res) => {
  res.render('login', { layout: undefined, message: req.query.message });
});

app.post('/', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.redirect("/?message=Invalid Username/Password");

  const loginStatus = await business.checkLogin(username, password);
  if (!loginStatus) return res.redirect("/?message=Invalid Username/Password");
  if (loginStatus === "inactive") return res.redirect("/?message=Please verify your email before logging in");

  const userType = (username === "admin") ? "admin" : "student";
  const session = await business.startSession({ username, userType });

  res.cookie('CMS_Session', session.uuid, { expires: session.expiry });
  res.redirect(userType === "admin" ? "/admin" : "/dashboard");
});

// Register
app.get('/register', (req, res) => {
  res.render('register', { layout: undefined, message: req.query.message });
});

app.post('/register', async (req, res) => {
  const { username, email, password, repeatPassword } = req.body;

  if (!username || !email || !password || !repeatPassword) {
    return res.redirect('/register?message=All fields are required');
  }

  if (password !== repeatPassword) {
    return res.redirect('/register?message=Passwords do not match');
  }

  const result = await business.createUser(username, password, email);
  if (!result.success) {
    return res.redirect('/register?message=' + encodeURIComponent(result.message));
  }

  res.redirect('/?message=Check console for activation code');
});

// Verify Email
app.get('/verify', (req, res) => {
  res.render('verify', { layout: undefined, message: req.query.message });
});

app.post('/verify', async (req, res) => {
  const { email, activationCode } = req.body;
  const success = await business.verifyUser(email, activationCode);
  res.redirect(success ? '/?message=Account activated successfully' : '/verify?message=Invalid activation code');
});

// Forgot Password
app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { layout: undefined, message: req.query.message });
});

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.redirect('/forgot-password?message=Please enter your email');

  const user = await business.getUserByEmail(email);
  if (!user) return res.redirect('/forgot-password?message=This email is not registered');

  console.log(`Password reset requested for ${email}`);
  res.redirect('/forgot-password?message=A password reset email has been sent');
});

// Logout
app.get('/logout', async (req, res) => {
  const sessionKey = req.cookies.CMS_Session;
  if (sessionKey) {
    await business.deleteSession(sessionKey);
    res.clearCookie('CMS_Session');
  }
  res.redirect('/?message=Logged out successfully');
});

// ------------------------------
// Student Routes
// ------------------------------

app.get('/dashboard', async (req, res) => {
  if (!req.user || req.userType !== "student") {
    return res.redirect("/?message=Unauthorized");
  }

  const courses = await business.getStudentCourses(req.user);
  const csrfToken = crypto.randomBytes(24).toString("hex");
  res.cookie("csrfToken", csrfToken);

  res.render('standard_dashboard', {
    layout: 'main',
    title: 'Student Dashboard',
    page: 'Dashboard',
    username: req.user,
    courses,
    csrfToken,
    userType: req.userType,
    semester: "Winter 2025"
  });
});

app.get('/my-requests', async (req, res) => {
  if (!req.user || req.userType !== "student") {
    return res.redirect("/?message=Unauthorized");
  }

  const semester = req.query.semester || "Winter 2025";
  const requests = await business.getRequestsByUser(req.user, semester);

  res.render('standard_dashboard', {
    layout: 'main',
    title: 'My Requests',
    page: 'My Requests',
    username: req.user,
    userType: req.userType,
    courses: await business.getStudentCourses(req.user),
    requests,
    csrfToken: crypto.randomBytes(24).toString("hex"),
    semester
  });  
});

app.post('/submit-request', async (req, res) => {
  if (!req.user || req.userType !== "student") {
    return res.redirect("/?message=Unauthorized");
  }

  const { category, details, csrfToken } = req.body;
  const cookieToken = req.cookies.csrfToken;

  if (!csrfToken || csrfToken !== cookieToken) {
    return res.status(403).send("Invalid CSRF token.");
  }

  if (!category || !details) {
    return res.redirect('/dashboard?message=All fields are required');
  }

  await business.submitRequest({ username: req.user, category, details });
  res.redirect('/dashboard?message=Request submitted successfully');
});

app.post('/cancel-request', async (req, res) => {
  if (!req.user || req.userType !== "student") {
    return res.redirect("/?message=Unauthorized");
  }

  const { requestId } = req.body;
  if (!requestId) return res.redirect('/my-requests?message=Invalid request');

  const success = await business.cancelRequestByUser(requestId, req.user);
  res.redirect(`/my-requests?message=${success ? "Request cancelled" : "Failed to cancel request"}`);
});

// ------------------------------
// Admin Routes
// ------------------------------

app.get('/admin', async (req, res) => {
  if (!req.user || req.userType !== "admin") return res.redirect("/?message=Unauthorized");

  const users = await business.getAllUsers();
  res.render('admin_dashboard', {
    layout: 'main',
    title: 'Admin Panel',
    page: 'Admin Dashboard',
    username: req.user,
    userType: req.userType, // ✅ Needed for the sidebar to work correctly
    users
  });
  
});

app.get('/admin/queues', async (req, res) => {
  if (!req.user || req.userType !== "admin") return res.redirect("/?message=Unauthorized");

  const allRequests = await business.getAllRequests();
  const queueStats = {};

  for (let r of allRequests) {
    if (!queueStats[r.category]) {
      queueStats[r.category] = { total: 0, pending: 0 };
    }
    queueStats[r.category].total++;
    if (r.status === "Pending") queueStats[r.category].pending++;
  }

  res.render('admin_queues', {
    layout: 'main',
    title: 'Request Queues',
    page: 'Manage Queues', // ✅ used in breadcrumb and for highlighting
    username: req.user,
    userType: req.userType,
    queueStats
  });
  
});

app.get('/admin/queue/:category', async (req, res) => {
  if (!req.user || req.userType !== "admin") return res.redirect("/?message=Unauthorized");

  const category = req.params.category;
  const requests = await business.getRequestsByCategory(category);

  res.render('admin_queue_detail', {
    layout: 'main',
    title: `${category} Queue`,
    page: 'Manage Queues',  // ✅ This keeps "Manage Queues" highlighted
    username: req.user,
    userType: req.userType,
    category,
    requests
  });
});


app.get('/admin/process/:id', async (req, res) => {
  if (!req.user || req.userType !== "admin") return res.redirect("/?message=Unauthorized");

  const request = await business.getRequestById(req.params.id);
  if (!request) return res.send("Request not found.");

  res.render('admin_process_request', {
    layout: 'main',
    title: 'Process Request',
    page: 'Process',
    username: req.user,
    request
  });
});

app.post('/admin/process/:id', async (req, res) => {
  if (!req.user || req.userType !== "admin") return res.redirect("/?message=Unauthorized");

  const { action, note } = req.body;
  if (!["Resolved", "Rejected"].includes(action)) return res.send("Invalid action.");

  await business.processRequest(req.params.id, action, note);
  console.log(`[EMAIL SIMULATION] Request ${req.params.id} was ${action}. Note: ${note}`);
  res.redirect('/admin/queues?message=Request processed');
});

app.post('/admin/activate', async (req, res) => {
  if (!req.user || req.userType !== "admin") return res.redirect("/?message=Unauthorized");

  await business.activateUser(req.body.email);
  res.redirect("/admin");
});

app.get('/admin/random-request', async (req, res) => {
  if (!req.user || req.userType !== "admin") return res.redirect("/?message=Unauthorized");

  const random = await business.getRandomPendingRequest();
  if (!random) return res.redirect("/admin/queues?message=No pending requests found.");

  res.redirect(`/admin/process/${random._id}`);
});

app.get('/widgets', (req, res) => {
  res.render('widgets', {
    title: 'Widgets',
    page: 'Widgets'
  });
});


// ✅ 🔥 Your test error route (safe here)
app.get('/test-error', (req, res) => {
  throw new Error("Simulated 500 error");
});


// 404 handler (must be last route)
app.use((req, res) => {
  res.status(404).render('404', {
    layout: false
  });
});

// 500 Internal Server Error handler
app.use((err, req, res, next) => {
  console.error("💥 500 error:", err.stack);
  res.status(500).render('500', { layout: false });
});


// ------------------------------
// Start Server
// ------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://127.0.0.1:${PORT}/`);
});
// ------------------------------
