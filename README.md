---

## 🚀 Milestone Overview

This milestone implements the foundational user flow of the Course Management System. It focuses on:
- User registration with email verification
- Login functionality with role-based redirection
- Session handling using cookies and MongoDB (no express-session)
- Admin dashboard for activating users
- Student dashboard to view enrolled courses
- Forgot password simulation via console logs

---

## ✅ Milestone Features Completed

| Feature                            | Status  |
|------------------------------------|---------|
| MongoDB database setup             | ✅     |
| Student & admin user registration  | ✅     |
| Email verification (console-based) | ✅     |
| Role-based login redirection       | ✅     |
| Session cookie + middleware        | ✅     |
| Admin dashboard with activation    | ✅     |
| Student dashboard with courses     | ✅     |
| Forgot password with console log   | ✅     |

---

## ⚙️ How to Run the Project:
1. Install dependencies:
npm install express body-parser cookie-parser express-handlebars mongodb crypto
---
2. Start the app:
node web.js
---
3. Open in your browser:
http://127.0.0.1:8000/

## 🧪 Example Test Flow:
1. Register as a student → check console for activation code
2. Go to /verify and activate account or Register as admin → directly go to /admin, activity the user
3. Login → see student dashboard
4. Try forgot password → see email log in terminal and the page information

## 📌 Notes:
- Session expire after 5 minutes
- Session info stored in MongoDB under Sessions collection
