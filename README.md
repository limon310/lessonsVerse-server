
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

