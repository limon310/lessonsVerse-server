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
// app.use(
//   cors({
//     origin: [
//       'http://localhost:5173',
//       'http://localhost:5174',
//       'https://b12-m11-session.web.app',
//     ],
//     credentials: true,
//     optionSuccessStatus: 200,
//   })
// )
app.use(
  cors({
    origin: [process.env.CLIENT_DOMAIN,
      "http://localhost:5173"

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
    req.user = decoded
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

    // MIDDLE WARE FOR VERIFY USER ACCESS CONTROL
    // middleware to check user type
    const user = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);
      if (user.isPremium !== true || user.role !== "admin") {
        return res.status(403).send({ message: "forbiden access" })
      }
      next();
    }

    // VERIFY ADMIN
    const verifyAdmin = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await userCollection.findOne({ email });
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: 'Admin only Actions!' })
      }
      next();
    }


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
      user.createdAt = new Date();
      user.lastLogin = new Date();
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
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const searchText = req.query.searchText || "";
      const adminEmail = req.tokenEmail;

      const matchStage = {
        email: { $ne: adminEmail }
      }

      if (searchText) {
        matchStage.displayName = { $regex: searchText, $options: "i" };
      }
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
    app.patch('/users/:id/role', verifyJWT, verifyAdmin, async (req, res) => {
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
    app.get('/users/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    })

    // get user by email and role
    app.get('/users/:email/role', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send({ role: result?.role || 'user' });
    })

    // delete user
    app.delete('/user/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // LESSONS RELETADE APIS HERE
    // create lessons
    app.post('/lessons', verifyJWT, async (req, res) => {
      const lessonsData = req.body;
      // console.log("lessons data in back end", lessonsData);
      lessonsData.createdAt = new Date();
      lessonsData.lastUpdated = new Date();
      lessonsData.isFeatured = false;
      lessonsData.isFlagged = false;
      const result = await lessonsCollection.insertOne(lessonsData);
      res.send(result);

    })

    // get lessons data
    app.get('/public-lessons', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const { search, category, emotion, sort } = req.query;

        let filter = {};

        // Access control
        if (!req.user) {
          filter.privacy = "Public";
        } else {
          const user = await userCollection.findOne({ email: req.tokenEmail });
          if (!user || (!user.isPremium && user.role !== 'admin')) {
            filter.privacy = "Public";
          }
        }

        if (search) {
          filter.title = { $regex: search, $options: 'i' };
        }

        // Category filter
        if (category) {
          filter.category = category;
        }

        // Emotional tone filter
        if (emotion) {
          filter.emotional_ton = emotion;
        }

        // Sorting
        let sortOption = { createdAt: -1 }; // default newest
        if (sort === "oldest") {
          sortOption = { createdAt: 1 };
        }

        // Total count
        const total = await lessonsCollection.countDocuments(filter);

        // Fetch lessons
        const lessons = await lessonsCollection
          .find(filter)
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .toArray();

        res.json({
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          lessons
        });

      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // author lessons
    app.get('/author-lessons', async (req, res) => {
      const { creatorId } = req.query;

      try {
        const lessons = await lessonsCollection.find({ creatorId }).toArray();
        res.json(lessons);
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
    })

    // get featured lesson
    app.get('/featured-lesson', async (req, res) => {
      try {
        const featuredLesson = lessonsCollection.find({
          isFeatured: true,
          privacy: "Public"
        }).sort({ createdAt: -1 }).limit(8);
        const result = await featuredLesson.toArray();
        res.send(result);
      }
      catch (error) {
        res.status(500).json({ error: error.message });
      }
    })

    // get specific lesson by id
    app.get('/lessonDetails/:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await lessonsCollection.findOne(query);
      res.send(result);
    })

    // get my lessons by email
    app.get('/my-lessons', verifyJWT, async (req, res) => {
      const email = req.tokenEmail;

      const query = {};

      if (email) {
        query["authorInfo.email"] = email;
      }

      const result = await lessonsCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    // get my public lessons by email for profile section
    app.get('/my-Publiclessons', verifyJWT, async (req, res) => {
      // const email = req.params.email;
      const email = req.tokenEmail;
      const { sort } = req.query;
      const query = {
        privacy: "Public",
        "authorInfo.email": email
      };
      // Sorting
      let sortOption = { createdAt: -1 }; // default newest
      if (sort === "oldest") {
        sortOption = { createdAt: 1 };
      }

      const result = await lessonsCollection.find(query).sort(sortOption).toArray();
      res.send(result);
    });

    // semilar lessons by category
    app.get('/similar-lessons', async (req, res) => {
      const { category, tone, id } = req.query;

      let query = {
        privacy: "Public",
        _id: { $ne: new ObjectId(id) }
      };

      if (category && tone) {
        query.$or = [
          { category },
          { emotional_ton: tone }
        ];
      } else if (category) {
        query.category = category;
      } else if (tone) {
        query.emotional_ton = tone;
      }

      const similarLessons = await lessonsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();

      res.send(similarLessons);
    });

    // for user dashboard home 
    // GET total created lessons for logged-in user
    app.get('/users/lessons/count/:email', async (req, res) => {
      try {
        const email = req.params.email;

        const totalCreatedLessons = await lessonsCollection.countDocuments({
          'authorInfo.email': email
        });

        res.send({
          totalCreatedLessons
        });
      } catch (error) {
        res.status(500).json({
          message: 'Failed to fetch lesson count',
          error: error.message
        });
      }
    });

    // GET total save lessons for logged-in user
    app.get('/users/saveLesson/count', verifyJWT, async (req, res) => {
      try {
        const userEmail = req.tokenEmail;

        const totalSaveLessons = await favoriteLessonCollection.countDocuments({
          email: userEmail
        });

        res.send({
          totalSaveLessons
        });
      } catch (error) {
        res.status(500).json({
          message: 'Failed to fetch lesson count',
          error: error.message
        });
      }
    });

    // top contributor of the week
    app.get('/top-contributors-week', async (req, res) => {
      try {

        // Today string like "12/15/2025"
        const today = new Date(); // current date & time
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0); // start of day

        const endOfWeek = new Date(today);
        endOfWeek.setHours(23, 59, 59, 999); // end of today

        const pipeline = [
          {
            $match: {
              createdAt: {
                $gte: startOfWeek,
                $lte: endOfWeek
              }
            }
          },
          {
            $group: {
              _id: "$creatorId",
              totalLessons: { $sum: 1 },
              name: { $first: "$authorInfo.name" },
              image: { $first: "$authorInfo.image" },
              email: { $first: "$authorInfo.email" }
            }
          },
          {
            $sort: { totalLessons: -1 }
          },
          {
            $limit: 3
          },
          {
            $project: {
              _id: 0,
              creatorId: "$_id",
              totalLessons: 1,
              name: 1,
              image: 1,
              email: 1
            }
          }
        ];

        const result = await lessonsCollection.aggregate(pipeline).toArray();
        res.send(result);

      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // get most save || favorite lessons
    app.get('/most-saved-lessons', async (req, res) => {
      try {
        const pipeline = [
          {
            $group: {
              _id: "$lessonId",
              totalSaves: { $sum: 1 }
            }
          },
          {
            $sort: { totalSaves: -1 }
          },
          {
            $limit: 5
          },
          {
            $lookup: {
              from: "lessons",
              localField: "_id",
              foreignField: "_id",
              as: "lessonInfo"
            }
          },
          {
            $unwind: "$lessonInfo"
          },
          {
            $project: {
              _id: 0,
              lessonId: "$_id",
              totalSaves: 1,
              title: "$lessonInfo.title",
              description: "$lessonInfo.description",
              category: "$lessonInfo.category",
              privacy: "$lessonInfo.privacy",
              emotional_ton: "$lessonInfo.emotional_ton",
              access_level: "$lessonInfo.access_level",
              creatorId: "$lessonInfo.creatorId"
            }
          }
        ];

        const result = await favoriteLessonCollection.aggregate(pipeline).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // get user created recent lessons for dashboard home
    app.get('/recent/lessons', verifyJWT, async (req, res) => {
      const email = req.tokenEmail;
      const query = {};
      if (email) {
        query["authorInfo.email"] = email;
      }
      const result = await lessonsCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.send(result);
    })

    // for user dashboard home analytic
    // data analytics for created lessona in a day
    app.get('/users/lessons/analytics/monthly', verifyJWT, async (req, res) => {
      try {
        const email = req.tokenEmail;

        // Start of current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Aggregate lessons per day
        const rawData = await lessonsCollection.aggregate([
          {
            $match: {
              'authorInfo.email': email,
              createdAt: { $gte: startOfMonth }
            }
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$createdAt"
                  }
                }
              },
              total: { $sum: 1 }
            }
          },
          {
            $sort: { "_id.date": 1 }
          }
        ]).toArray();

        // Convert aggregation to map
        const dataMap = {};
        rawData.forEach(item => {
          dataMap[item._id.date] = item.total;
        });

        // Normalize full month (day-wise)
        const result = [];
        const today = new Date();
        const totalDays = today.getDate();

        for (let day = 1; day <= totalDays; day++) {
          const date = new Date(startOfMonth);
          date.setDate(day);

          const key = date.toLocaleDateString("en-CA");

          result.push({
            date: key,
            day,
            totalLessons: dataMap[key] || 0
          });
        }

        res.send(result);

      } catch (error) {
        res.status(500).json({
          message: 'Failed to load monthly lesson analytics',
          error: error.message
        });
      }
    });

    // total lesson created in a month
    app.get('/users/lessons/analytics/monthly-total', verifyJWT, async (req, res) => {
      try {
        const email = req.tokenEmail;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const result = await lessonsCollection.aggregate([
          {
            $match: {
              'authorInfo.email': email,
              createdAt: { $gte: startOfMonth }
            }
          },
          {
            $group: {
              _id: null,
              totalLessons: { $sum: 1 }
            }
          }
        ]).toArray();

        res.send({
          totalLessons: result[0]?.totalLessons || 0
        });

      } catch (error) {
        res.status(500).json({
          message: 'Failed to get monthly total lessons',
          error: error.message
        });
      }
    });

    // update lessons
    app.patch('/my-lessons/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      const query = { _id: new ObjectId(id) };

      const updateData = {
        $set: {
          title: data.title,
          access_level: data.access_level,
          category: data.category,
          privacy: data.privacy,
          description: data.description,
          emotional_ton: data.emotional_ton,
          lastUpdated: new Date()
          // authorInfo: {
          //   name: data.authorInfo.name,
          //   email: data.authorInfo.email,
          // }
        }
      };
      const result = await lessonsCollection.updateOne(query, updateData);
      res.send(result);
    });

    // update visibility
    app.patch('/my-lessons/:id/visibility', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { visibility } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          privacy: visibility,
          lastUpdated: new Date()
        }
      }
      const result = await lessonsCollection.updateMany(query, updateDoc);
      res.send(result);
    })

    // update access level
    app.patch('/my-lessons/:id/access', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { access_level } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          access_level: access_level,
          lastUpdated: new Date()
        }
      }
      const result = await lessonsCollection.updateMany(query, updateDoc);
      res.send(result);
    })

    // delete my lessons
    app.delete('/lesson/:id', verifyJWT, async (req, res) => {
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
                currency: "bdt",
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
          cancel_url: `${process.env.CLIENT_DOMAIN}/payment-cancel`,
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
    app.post('/favorite-lessons/:lessonId', verifyJWT, async (req, res) => {
      const { lessonId } = req.params;
      const { email, title, category, emotional_ton } = req.body;

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
        category,
        emotional_ton,
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
    app.post('/like-lessons/:lessonId', verifyJWT, async (req, res) => {
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
    app.post('/lesson-comment', verifyJWT, async (req, res) => {
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
    app.post('/report-lesson/:lessonId', verifyJWT, async (req, res) => {
      const { lessonId } = req.params;
      const { email, reason, displayName, userId } = req.body;

      // update isFlagged true
      const updateDoc = {
        $set: {
          isFlagged: true,
          lastUpdated: new Date()
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
        isFlagged: true
      });

      res.send({ success: true });
    });

    app.get('/flagged-lessons', async (req, res) => {
      try {
        const result = await reportLessonCollection.aggregate([
          // Group by lessonId
          {
            $group: {
              _id: "$lessonId",
              reportCount: { $sum: 1 },
              reports: {
                $push: {
                  reason: "$reason",
                  email: "$email",
                  displayName: "$displayName",
                  reportedAt: "$timestamp"
                }
              }
            }
          },

          {
            $lookup: {
              from: "lessons",
              localField: "_id",
              foreignField: "_id",
              as: "lessonDetails"
            }
          },
          { $unwind: "$lessonDetails" },
          {
            $project: {
              lessonId: "$_id",
              lessonTitle: "$lessonDetails.title",
              reportCount: 1,
              reports: 1
            }
          },
          { $sort: { reportCount: -1 } }
        ]).toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to fetch flagged lessons" });
      }
    });

    // delete flagged lessons
    app.delete('/delete-flagged-lesson/:id', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const lessonId = req.params.id;
        const query = { lessonId: new ObjectId(lessonId) }
        const result = reportLessonCollection.deleteOne(query);
        res.send(result);
      }
      catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to delete flagged lessons" });
      }

    })

    // get my favorite lessons
    app.get('/my-favorite-lessons', verifyJWT, async (req, res) => {
      const { category, emotional_ton } = req.query;
      // const email = req.params.email;
      const email = req.tokenEmail;

      const query = { email };
      if (category) {
        query.category = category;
      }
      if (emotional_ton) {
        query.emotional_ton = emotional_ton;
      }
      const result = await favoriteLessonCollection.find(query).toArray();
      res.send(result);
    })

    // remove from favorite
    app.delete('/remove-favorite/:lessonId', verifyJWT, async (req, res) => {
      const { lessonId } = req.params

      const query = {
        lessonId: new ObjectId(lessonId)
      };
      const result = await favoriteLessonCollection.deleteOne(query)
      res.send(result);
    });

    // admin only access
    app.get('/admin/lessons-filter', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { category, visibility, flagged } = req.query;

        const query = {};

        // Filter by category
        if (category) {
          query.category = category;
        }

        // Filter by visibility
        if (visibility) {
          query.privacy = visibility;
        }
        // Filter by flagged
        if (flagged === 'true') {
          query.isFlagged = true;
        }

        if (flagged === 'false') {
          query.isFlagged = false;
        }

        const lessons = await lessonsCollection.find(query).toArray();
        res.send(lessons);

      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // GET PUBLIC, PRIVATE, AND FLAGGED COUNT
    app.get('/admin/lessons/stats', verifyJWT, verifyAdmin, async (req, res) => {

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
    app.patch('/updateLesson/:id/featured', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          isFeatured: true,
          lastUpdated: new Date()
        }
      }
      const result = await lessonsCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    // update report collection status
    app.patch('/update-status/:id', verifyJWT, verifyAdmin, async (req, res) => {
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

    // ADMIN DASHBOARD ANALYTICS APIS HERE
    // get total user, public lessons, flagged lessons
    app.get("/admin/stats/users-lessons-flagged", verifyJWT, verifyAdmin, async (req, res) => {

      const totalUsers = await userCollection.countDocuments();

      const totalPublicLessons = await lessonsCollection.countDocuments({ privacy: "Public" });

      const totalFlaggedLessons = await reportLessonCollection.countDocuments();


      res.send({
        totalUsers,
        totalPublicLessons,
        totalFlaggedLessons
      });
    });

    // todays lesson count
    app.get("/admin/lessons/today/count", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const todayLessonCount = await lessonsCollection.countDocuments({
          createdAt: { $gte: start, $lt: end }
        });

        res.json({ todayLessons: todayLessonCount });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // user and lesson growth
    app.get("/admin/growth-chart", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        // Lessons growth
        const lessonGrowth = await lessonsCollection.aggregate([
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } }
        ]).toArray();

        // Users growth
        const userGrowth = await userCollection.aggregate([
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } }
        ]).toArray();

        res.json({
          lessonGrowth: lessonGrowth.map(i => ({
            date: i._id,
            count: i.count
          })),
          userGrowth: userGrowth.map(i => ({
            date: i._id,
            count: i.count
          }))
        });

      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log('Pinged your deployment. You successfully connected to MongoDB!'
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
