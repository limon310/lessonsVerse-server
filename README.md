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
