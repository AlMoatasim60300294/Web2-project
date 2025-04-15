const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const business = require('./business.js');
const path = require('path');

const app = express();
const handlebars = require('express-handlebars');

// Express setup
app.set('views', __dirname + "/templates");
app.use(express.static(__dirname + "/public"));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.set('view engine', 'hbs');

// Handlebars setup with helpers
app.engine('hbs', handlebars.engine({
    extname: '.hbs',
    layoutsDir: __dirname + '/templates',
    defaultLayout: 'layout',
    helpers: {
        formatDate: function(date) {
            return new Date(date).toLocaleDateString();
        },
        statusColor: function(status) {
            switch(status) {
                case 'pending': return 'warning';
                case 'approved': return 'success';
                case 'rejected': return 'danger';
                default: return 'secondary';
            }
        },
        eq: function(v1, v2) {
            return v1 === v2;
        }
    }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Login routes
app.get('/', (req, res) => {
    res.render('login', { 
        title: 'Login',
        message: req.query.message 
    });
});

app.post('/', async (req, res) => {
    const userType = await business.checkLogin(req.body.username, req.body.password);
    if (!userType) {
        return res.redirect('/?message=Invalid Username/Password');
    }

    const sessionData = {
        username: req.body.username,
        UserType: userType
    };

    const session = await business.startSession(sessionData);
    res.cookie('CMS_Session', session.uuid, { expires: session.expiry });
    res.redirect('/dashboard');
});

// Dashboard routes
app.get('/dashboard', async (req, res) => {
    let sessionKey = req.cookies.CMS_Session;
    if (!sessionKey) {
        return res.redirect("/?message=Please log in");
    }

    let sessionData = await business.getSessionData(sessionKey);
    if (!sessionData) {
        return res.redirect("/?message=Session expired");
    }

    const semester = req.query.semester || 'all';
    const requests = await business.getUserRequests(sessionData.username, semester);
    
    res.render("dashboard", { 
        title: 'Dashboard',
        username: sessionData.username,
        requests: requests,
        currentSemester: semester,
        semesters: await business.getAvailableSemesters(sessionData.username),
        sidebar: true
    });
});

// Request management
app.post('/submit-request', async (req, res) => {
    const sessionKey = req.cookies.CMS_Session;
    if (!sessionKey) {
        return res.redirect("/?message=Please log in");
    }

    const sessionData = await business.getSessionData(sessionKey);
    if (!sessionData) {
        return res.redirect("/?message=Session expired");
    }

    try {
        const { category, details } = req.body;
        await business.submitRequest(sessionData.username, category, details);
        // Simulate email notification
        console.log(`Email notification: New request submitted by ${sessionData.username}`);
        res.redirect('/dashboard?message=Request submitted successfully');
    } catch (error) {
        console.error('Error submitting request:', error);
        res.redirect('/dashboard?message=Error submitting request');
    }
});

// Register routes
app.get('/register', (req, res) => {
    res.render('register', { 
        title: 'Register',
        message: req.query.message 
    });
});

app.post('/register', async (req, res) => {
    const result = await business.createUser(
        req.body.username,
        req.body.password,
        req.body.email
    );

    if (!result.success) {
        return res.redirect('/register?message=' + result.message);
    }

    res.redirect('/?message=Registration successful! Please log in.');
});

// Forgot password routes
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { 
        title: 'Forgot Password',
        message: req.query.message 
    });
});

app.post('/forgot-password', async (req, res) => {
    const user = await business.getUserByEmail(req.body.email);
    if (!user) {
        return res.render('forgot-password', {
            message: 'If this email exists in our system, you will receive reset instructions.'
        });
    }

    // Simulate email sending
    console.log(`Password reset email sent to: ${req.body.email}`);
    res.render('forgot-password', {
        message: 'If this email exists in our system, you will receive reset instructions.',
        success: true
    });
});

// Logout route
app.get('/logout', async (req, res) => {
    const sessionKey = req.cookies.CMS_Session;
    if (sessionKey) {
        await business.deleteSession(sessionKey);
        res.clearCookie('CMS_Session');
    }
    res.redirect('/?message=Logged out successfully');
});



// ========== Department Head Panel Routes ==========

// HOD Dashboard - stats
app.get('/hod/dashboard', async (req, res) => {
    const allRequests = await business.getAllRequests();
    const stats = {
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'pending').length,
        approved: allRequests.filter(r => r.status === 'approved').length,
        rejected: allRequests.filter(r => r.status === 'rejected').length
    };
    res.render('hod-dashboard', { title: 'HoD Dashboard', stats });
});

// HOD Queue View
app.get('/hod/queue', async (req, res) => {
    const requests = await business.getAllRequests();
    res.render('hod-queue', { title: 'Request Queue', requests });
});

// HOD Request Detail
app.get('/hod/request/:id', async (req, res) => {
    const request = await business.getRequestById(req.params.id);
    if (!request) return res.send('Request not found');
    res.render('hod-request-detail', { title: 'Request Detail', request });
});

// HOD Process/Reject with Note
app.post('/hod/request/:id/process', async (req, res) => {
    const { action, note } = req.body;
    const success = await business.updateRequestStatus(req.params.id, action, note);

    if (success) {
        console.log(`Email simulation: Request ${req.params.id} has been ${action}. Note: ${note}`);
        res.redirect('/hod/queue');
    } else {
        res.send('Error updating request');
    }
});

// HOD Random Request Picker
app.get('/hod/random-request', async (req, res) => {
    const allRequests = await business.getAllRequests();
    const pending = allRequests.filter(r => r.status === 'pending');

    if (pending.length === 0) {
        return res.render('hod-random-request', { title: 'Random Request', message: 'No pending requests.' });
    }

    const randomRequest = pending[Math.floor(Math.random() * pending.length)];
    res.render('hod-random-request', { title: 'Random Request', request: randomRequest });
});


// Middleware to check HoD access
function requireHoD(req, res, next) {
    if (!req.cookies.CMS_Session) return res.redirect('/?message=Login required');
    business.getSessionData(req.cookies.CMS_Session).then(session => {
        if (!session || session.UserType !== 'hod') {
            return res.redirect('/?message=Access Denied');
        }
        req.session = session;
        next();
    });
}

// HOD Dashboard
app.get('/hod/dashboard', requireHoD, async (req, res) => {
    const stats = await business.getQueueStats();
    res.render('hod-dashboard', {
        title: 'HoD Dashboard',
        sidebar: true,
        ...stats
    });
});

// HOD Queue
app.get('/hod/queue', requireHoD, async (req, res) => {
    const allRequests = await business.getAllRequests();
    res.render('hod-queue', {
        title: 'Queue',
        sidebar: true,
        requests: allRequests
    });
});

// HOD View Single Request
app.get('/hod/request/:id', requireHoD, async (req, res) => {
    const request = await business.getRequestById(req.params.id);
    res.render('hod-request-detail', {
        title: 'Request Detail',
        sidebar: true,
        request
    });
});

// Process or Reject Request
app.post('/hod/request/:id', requireHoD, async (req, res) => {
    const { action, note } = req.body;
    const status = action === 'approve' ? 'approved' : 'rejected';
    await business.updateRequestStatus(req.params.id, status, note);
    res.redirect('/hod/queue');
});

// HOD Random Picker
app.get('/hod/random', requireHoD, async (req, res) => {
    const request = await business.getRandomPendingRequest();
    res.render('hod-random-request', {
        title: 'Random Picker',
        sidebar: true,
        request
    });
});


app.listen(5000, () => {
    console.log('\x1b[36m%s\x1b[0m', `Server running at http://localhost:8000 (CTRL + Click to open)`);
});