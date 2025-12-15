require('dotenv').config();
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const stripe = require('stripe')(process.env.STRIPE_SECRET);
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
    const paymentCollection = db.collection("payment");
    const favoriteLessonCollection = db.collection("favoriteLessons");
    const likeLessonCollection = db.collection("likeLessons");
    const reportLessonCollection = db.collection("reportLessons");
    const commentCollection = db.collection("comments");

    // create index 
    favoriteLessonCollection.createIndex(
      { lessonId: 1, email: 1 },
      { unique: true }
    );

    likeLessonCollection.createIndex(
      { lessonId: 1, email: 1 },
      { unique: true }
    );

    // save user in db
    app.post('/users', async (req, res) => {
      const user = req.body;
      user.isPremium = false;
      user.createdAt = new Date().toISOString();
      user.lastLogin = new Date().toISOString();
      user.role = "user";
      const query = {
        email: user.email
      }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        const result = await userCollection.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toLocaleString(),
          },
        })
        return res.send(result)
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // get user for showing admin dashboard manage users section
    app.get('/users', async (req, res) => {
      const searchText = req.query.searchText || "";

      const matchStage = searchText
        ? { displayName: { $regex: searchText, $options: "i" } }
        : {};
      const users = await userCollection.aggregate([
        { $match: matchStage },

        {
          $lookup: {
            from: "lessons",
            localField: "email",
            foreignField: "authorInfo.email",
            as: "lessons"
          }
        },

        {
          $addFields: {
            totalLessonsCreated: { $size: "$lessons" }
          }
        },

        {
          $project: {
            displayName: 1,
            email: 1,
            role: 1,
            photoURL: 1,
            totalLessonsCreated: 1,
          }
        },

        { $sort: { createdAt: -1 } },
        { $limit: 5 }
      ]).toArray();

      res.send(users);
    });


    // update user role
    app.patch('/users/:id/role', async (req, res) => {
      const id = req.params.id;
      const roleInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: roleInfo.role
        }
      }
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    // get user by email
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    })

    // get user by email and role
    app.get('/users/:email/role', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send({ role: result?.role || 'user' });
    })

    // LESSONS RELETADE APIS HERE
    // create lessons
    app.post('/lessons', async (req, res) => {
      const lessonsData = req.body;
      // console.log("lessons data in back end", lessonsData);
      lessonsData.createdAt = new Date().toLocaleDateString();
      lessonsData.lastUpdated = new Date().toLocaleDateString();
      lessonsData.isFeatured = false;
      lessonsData.isFlagged = false;
      const result = await lessonsCollection.insertOne(lessonsData);
      res.send(result);

    })

    // get lessons data
    app.get('/public-lessons', async (req, res) => {
      try {
        const lessons = lessonsCollection.find(
          { privacy: "Public" }
        );
        const result = await lessons.toArray();

        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // get featured lesson
    app.get('/featured-lesson', async(req, res) =>{
      try{
        const featuredLesson = lessonsCollection.find({
          isFeatured: true,
          privacy: "Public"
        }).sort({createdAt: -1}).limit(6);
        const result = await featuredLesson.toArray();
        res.send(result);
      }
      catch(error){
        res.status(500).json({error: error.message});
      }
    })


    // get specific lesson by id
    app.get('/lessonDetails/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await lessonsCollection.findOne(query);
      res.send(result);
    })

    // get my lessons by email
    app.get('/my-lessons/:email', async (req, res) => {
      const email = req.params.email;

      const query = {};

      if (email) {
        query["authorInfo.email"] = email;
      }

      const result = await lessonsCollection.find(query).toArray();
      res.send(result);
    });

    // update lessons
    app.patch('/my-lessons/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      const query = { _id: new ObjectId(id) };

      const updateData = {
        $set: {
          title: data.title,
          access_level: data.access_level,
          createdAt: data.createdAt,
          authorInfo: {
            name: data.authorInfo.name,
            email: data.authorInfo.email,
          }
        }
      };
      const result = await lessonsCollection.updateOne(query, updateData);
      res.send(result);
    });

    // update visibility
    app.patch('/my-lessons/:id/visibility', async (req, res) => {
      const id = req.params.id;
      const { visibility } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          privacy: visibility,
          lastUpdated: new Date().toLocaleDateString()
        }
      }
      const result = await lessonsCollection.updateMany(query, updateDoc);
      res.send(result);
    })

    // update access level
    app.patch('/my-lessons/:id/access', async (req, res) => {
      const id = req.params.id;
      const { access_level } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          access_level: access_level,
          lastUpdated: new Date().toLocaleDateString()
        }
      }
      const result = await lessonsCollection.updateMany(query, updateDoc);
      res.send(result);
    })

    // delete my lessons
    app.delete('/lesson/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await lessonsCollection.deleteOne(query);
      res.send(result);
    })

    // PAYMENT RELATED APIS HERE
    app.post('/create-checkout-session', async (req, res) => {
      try {
        const paymentInfo = req.body;
        const price = paymentInfo?.price;
        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: Number(price) * 100,
                product_data: {
                  name: paymentInfo.package_name || "Premium Membership"
                }
              },
              quantity: 1
            }
          ],
          mode: 'payment',
          customer_email: paymentInfo?.customer_email,
          metadata: {
            customer_email: paymentInfo?.customer_email,
            plan: paymentInfo?.plan,
            customer_id: paymentInfo?.customer_id
          },
          success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_DOMAIN}/upgrade-premium`,
        });

        res.send({ url: session.url });

      } catch (error) {
        console.error("Stripe session error:", error.message);
        res.status(500).json({ error: error.message });
      }
    });

    // success-payment
    app.patch('/payment-success', async (req, res) => {
      try {
        const sessionId = req.query.session_id;

        // Retrieve session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // Check payment status
        if (session.payment_status !== "paid") {
          return res.status(400).json({ message: "Payment not completed" });
        }

        // Extract metadata
        // const customerId = session.metadata.customer_id;
        const customerEmail = session.metadata.customer_email;
        const plan = session.metadata.plan;

        // 1. Save payment history 
        const paymentDoc = {
          transactionId: session.payment_intent,
          amount: session.amount_total / 100,
          email: customerEmail,
          plan,
          createdAt: new Date()
        };

        // Check if this transaction already saved
        const existingOrder = await paymentCollection.findOne({
          transactionId: session.payment_intent
        });

        if (!existingOrder) {
          await paymentCollection.insertOne(paymentDoc);
        }

        // 2. Update userCollection: Set isPremium: true
        const updateResult = await userCollection.updateOne(
          { email: customerEmail },
          {
            $set: {
              isPremium: true,
              premiumActivatedAt: new Date(),
              premiumPlan: plan,
            }
          }
        );

        console.log("Premium updated:", updateResult);

        res.send({
          success: true,
          message: "Payment success and premium activated."
        });

      } catch (error) {
        console.error("Payment success error:", error.message);
        res.status(500).json({ error: error.message });
      }
    });

    // FAVORITE LESSON RELETADE APIS HERE

    // save favorite lessons
    app.post('/favorite-lessons/:lessonId', async (req, res) => {
      const { lessonId } = req.params;
      const { email, title } = req.body;

      const query = {
        lessonId: new ObjectId(lessonId),
        email
      };

      const existing = await favoriteLessonCollection.findOne(query);

      if (existing) {
        await favoriteLessonCollection.deleteOne(query);
        return res.send({ action: "removed" });
      }

      await favoriteLessonCollection.insertOne({
        lessonId: new ObjectId(lessonId),
        email,
        title,
        createdAt: new Date()
      });

      res.send({ action: "added" });
    });

    // check if user favorite a lesson
    app.get('/favorite-lessons/check', async (req, res) => {
      const { lessonId, email } = req.query;

      const exists = await favoriteLessonCollection.findOne({
        lessonId: new ObjectId(lessonId),
        email
      });

      res.send({ isFavorited: !!exists });
    });

    // favorite lessons count
    app.get('/favorite-lessons/count/:lessonId', async (req, res) => {
      const { lessonId } = req.params;

      const count = await favoriteLessonCollection.countDocuments({
        lessonId: new ObjectId(lessonId)
      });

      res.send({ count });
    });

    // like toogle
    app.post('/like-lessons/:lessonId', async (req, res) => {
      const { lessonId } = req.params;
      const { email } = req.body;

      const query = {
        lessonId: new ObjectId(lessonId),
        email
      };

      const existing = await likeLessonCollection.findOne(query);

      if (existing) {
        await likeLessonCollection.deleteOne(query);
        return res.send({ action: "removed" });
      }

      await likeLessonCollection.insertOne({
        lessonId: new ObjectId(lessonId),
        email,
        createdAt: new Date()
      });

      res.send({ action: "added" });
    });

    // check if user liked a lessons
    app.get('/like-lessons/check', async (req, res) => {
      const { lessonId, email } = req.query;

      const exists = await likeLessonCollection.findOne({
        lessonId: new ObjectId(lessonId),
        email
      });

      res.send({ isLiked: !!exists });
    });

    // like count
    app.get('/like-lessons/count/:lessonId', async (req, res) => {
      const { lessonId } = req.params;

      const count = await likeLessonCollection.countDocuments({
        lessonId: new ObjectId(lessonId)
      });

      res.send({ count });
    });

    // post comment
    app.post('/lesson-comment', async (req, res) => {
      const userInfo = req.body;
      const result = await commentCollection.insertOne(userInfo);
      res.send(result);
    })

    // get user comment
    app.get('/getUser-comment', async (req, res) => {
      const result = await commentCollection.find().limit(3).toArray();
      res.send(result);
    })

    // report lessons
    app.post('/report-lesson/:lessonId', async (req, res) => {
      const { lessonId } = req.params;
      const { email, reason, displayName, userId } = req.body;

      // update isFlagged true
      const updateDoc = {
        $set: {
          isFlagged: true,
          lastUpdated: new Date().toLocaleDateString()
        }
      }
      await lessonsCollection.updateOne({ _id: new ObjectId(lessonId) }, updateDoc);

      await reportLessonCollection.insertOne({
        lessonId: new ObjectId(lessonId),
        email,
        reason,
        displayName,
        userId,
        timestamp: new Date(),
        status: "pending",
        isFlagged: true,
      });

      res.send({ success: true });
    });

    // get my favorite lessons
    app.get('/my-favorite-lessons/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await favoriteLessonCollection.find(query).toArray();
      res.send(result);
    })

    // remove from favorite
    app.delete('/remove-favorite/:lessonId', async (req, res) => {
      const { lessonId } = req.params

      const query = {
        lessonId: new ObjectId(lessonId)
      };
      const result = await favoriteLessonCollection.deleteOne(query)
      res.send(result);
    });

    // admin only access
    // get all lessons createdt by users
    app.get('/admin/lessons', async (req, res) => {
      try {
        const { category, privacy, flagged } = req.query;

        const query = {};

        // Filter by category
        if (category) {
          query.category = category;
        }

        // Filter by visibility
        if (privacy) {
          query.privacy = privacy;
        }

        // Filter by flagged lessons
        if (flagged === "true") {
          query.isFlagged = true;
        }

        const lessons = await lessonsCollection.find(query).toArray();
        res.send(lessons);

      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });


    // GET PUBLIC, PRIVATE, AND FLAGGED COUNT
    app.get('/admin/lessons/stats', async (req, res) => {

      const publicLessons = await lessonsCollection.countDocuments({
        privacy: "Public"
      });

      const privateLessons = await lessonsCollection.countDocuments({
        privacy: "Private"
      });

      const flaggedLessons = await lessonsCollection.countDocuments({
        isFlagged: true
      });

      res.send({
        publicLessons,
        privateLessons,
        flaggedLessons
      });
    });

    // update isFeatured on admin routed
    app.patch('/updateLesson/:id/featured', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          isFeatured: true,
          lastUpdated: new Date().toLocaleDateString()
        }
      }
      const result = await lessonsCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    // update report collection status
    app.patch('/update-status/:id', async (req, res) => {
      const id = req.params.id;
      const query = { lessonId: new ObjectId(id), statu };
      const updateStatus = {
        $set: {
          status: "reviewed"
        }
      }
      const result = await reportLessonCollection.updateOne(query, updateStatus);
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
