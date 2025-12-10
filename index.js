require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb')
const admin = require('firebase-admin')
const port = process.env.PORT || 3000
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
  'utf-8'
)
const serviceAccount = JSON.parse(decoded)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const app = express()
// middleware
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://b12-m11-session.web.app',
    ],
    credentials: true,
    optionSuccessStatus: 200,
  })
)
app.use(express.json())

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(' ')[1]
  console.log(token)
  if (!token) return res.status(401).send({ message: 'Unauthorized Access!' })
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.tokenEmail = decoded.email
    console.log(decoded)
    next()
  } catch (err) {
    console.log(err)
    return res.status(401).send({ message: 'Unauthorized Access!', err })
  }
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
async function run() {
  try {
    // DB COLLECTION
    const db = client.db("lessonsVersDb");
    const userCollection = db.collection("users");
    const lessonsCollection = db.collection("lessons");

    // save user in db
    app.post('/users', async (req, res) => {
      const user = req.body;
      user.isPremium = false;
      user.createdAt = new Date().toISOString();
      user.lastLogin = new Date().toISOString();
      user.role = "customer";
      user.isFeatured = false;
      const query = {
        email: user.email
      }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        const result = await userCollection.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toISOString(),
          },
        })
        return res.send(result)
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // LESSONS RELETADE APIS HERE
    // create lessons
    app.post('/lessons', async(req, res) =>{
      const lessonsData = req.body;
      // console.log("lessons data in back end", lessonsData);
      lessonsData.createdAt = new Date().toLocaleString();
      lessonsData.lastUpdated = new Date().toLocaleString();
      const result = await lessonsCollection.insertOne(lessonsData);
      res.send(result);

    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from Server..')
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
