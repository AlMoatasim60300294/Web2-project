## 🚀 Milestone Overview

This milestone implements the foundational user flow of the Course Management System. It focuses on:
1. User registration with email verification
2. Login functionality with role-based redirection
3. Session handling using cookies and MongoDB (no express-session)
4. Admin dashboard for activating users
5. Student dashboard to view enrolled courses
6. Forgot password simulation via console logs

---

## 📁 Folder Structure Overview:
- `/public` → Static files (CoreUI under `/dist`)
- `/templates` → Handlebars views
- `business.js` → Core business logic
- `persistence.js` → MongoDB interaction layer
- `web.js` → Main Express server

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
1. Click on (Register Now!). register 2 account (student-admin)
2. Log in as admin to view the account you have to check the status of the users. (admin it is automatully active)
3. 2 way to active the (standard/student) account:
   - click action in the admin account
   - in URL enter: http://127.0.0.1:8000/verify // enter the email email and the activation code
4. Log in to admin account to check the action of the student user. it is active. Log out
5. Log in to the student account
6. create a request:
   - create a request Category
   - enter a Details about the request
   - click on the submit request you to the same page with successfully submitted
7. click on My Requests, at the bottom page. if student want to close it (click on close button)
8. Log out from the user account and enter the admin account
9. see list of the user in admin Dashboard
10. see the request queues are  made from the students
11. click on the view Queue
12. takes you to page to see the details about the request
13. click on process
14. the admin user can (resolve - reject) take an action. and add some notes.
15. pick a random request is by visit:  http://127.0.0.1:8000/admin/random-request  / gives you a random page
16. in the Login page click on the forget page. enter you page if gmail in the database send a message (A password reset email has been sent). else message (This email is not registered).

## 📌 Notes:
- Session expire after 5 minutes
- Session info stored in MongoDB under Sessions collection
- youtube video: https://youtu.be/3W2VN-yMYL0?si=6SUGVXLpksLKrdLI
