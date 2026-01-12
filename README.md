<<<<<<< HEAD

## **Backend **

```markdown
# LessonVerse Backend

The **backend** of LessonVerse is a Node.js and Express.js REST API that handles authentication, lesson management, and user interactions.

---

## Table of Contents

- [Features](#features)  
- [Technologies](#technologies)  
- [Installation](#installation)  
- [API Endpoints](#api-endpoints)  
- [Usage](#usage)  
- [License](#license)  

---

## Features

- User registration and authentication  
- Create, update, and delete lessons  
- Like, comment, and share lessons  
- Track favorite lessons  
- Admin management for flagged content  

---

## Technologies

- Node.js  
- Express.js  
- MongoDB  
- JWT Authentication  

---

## Installation

1. Clone the repository:  
```bash
git clone https://github.com/limon310/lessonsVerse-server.git

2. Install dependencies:

npm install

3. Create a .env file and add required variables:

PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key

## API Endpoints

POST /register – Register a new user

POST /login – Login and receive a JWT

GET /public-lessons – Retrieve all lessons

POST /dashboard/add-lesson – Create a new lesson

PUT /dashboard/my-lesson/:id – Update a lesson by ID

DELETE /dashboard/my-lesson/:id – Delete a lesson by ID

GET /favorite-lessons/count/:lessonId – Get favorite count for a lesson

Refer to the backend repository for full API documentation.

##Usage

Start the development server:

npm run dev

# License

This project is licensed under the MIT License.


---

=======
# LessonVerse - Backend

## Project Overview
LessonVerse is a platform where users can create, read, like, comment, share, and report lessons. The backend handles all data processing, authentication, and role-based access for **Admin** and **User** roles. It also provides APIs for the frontend and supports a dashboard for managing lessons and users.

## Features
- User authentication and role-based access (Admin/User)
- CRUD operations for lessons
- Like, comment, share, and report functionality
- Admin dashboard for managing users and lessons
- Secure API endpoints

## Tech Stack
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT for authentication
- Bcrypt for password hashing

## API Endpoints
### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - User login

### Lessons
- `GET /api/lessons` - Get all lessons
- `GET /api/lessons/:id` - Get a lesson by ID
- `POST /api/lessons` - Create a new lesson (Admin/User)
- `PUT /api/lessons/:id` - Update lesson
- `DELETE /api/lessons/:id` - Delete lesson

### Interactions
- `POST /api/lessons/:id/like` - Like a lesson
- `POST /api/lessons/:id/comment` - Comment on a lesson
- `POST /api/lessons/:id/report` - Report a lesson
- `POST /api/lessons/:id/share` - Share a lesson

### Dashboard (Admin)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/lessons` - Get all lessons for admin

## Installation
1. Clone the repository:
```bash
git clone https://github.com/limon310/lessonVerse-server.git


Install dependencies:

npm install


Create a .env file and configure:

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret


Start the server:

npm run dev


Server runs at http://localhost:5000

Folder Structure
lessonverse-backend/
│
├── controllers/      # Handles API request logic
├── models/           # MongoDB models
├── routes/           # Express routes
├── middleware/       # Authentication & error handling
├── config/           # Database connection and config
├── utils/            # Helper functions
├── server.js         # Entry point
└── package.json

Contributing

Fork the repository

Create a new branch (git checkout -b feature/YourFeature)

Commit your changes (git commit -m 'Add some feature')

Push to the branch (git push origin feature/YourFeature)

Open a Pull Request

License

This project is licensed under the MIT License.
>>>>>>> 37cca17545ead2f3c0598de897c01e32e9e2c111
