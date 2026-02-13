const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const { Firestore } = require("@google-cloud/firestore");

const app = express();

// Firestore setup
const db = new Firestore({
  keyFilename: "serviceAccountKey.json"
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: "mySecret123",
  resave: false,
  saveUninitialized: false
}));

app.set("view engine", "ejs");

// Protect Dashboard
function isLoggedIn(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
}

// HOME
app.get("/", (req, res) => {
  res.render("home");
});

// SIGNUP
app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.render("signup", { error: "All fields required" });
  }

  const check = await db.collection("users")
    .where("email", "==", email)
    .get();

  if (!check.empty) {
    return res.render("signup", { error: "User already exists" });
  }

  const userRef = await db.collection("users").add({
    name,
    email,
    password
  });

  req.session.userId = userRef.id;
  req.session.userName = name;

  res.redirect("/dashboard");
});

// LOGIN
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const snapshot = await db.collection("users")
    .where("email", "==", email)
    .get();

  if (snapshot.empty) {
    return res.render("login", { error: "User not found" });
  }

  const user = snapshot.docs[0];

  if (user.data().password !== password) {
    return res.render("login", { error: "Wrong password" });
  }

  req.session.userId = user.id;
  req.session.userName = user.data().name;

  res.redirect("/dashboard");
});

// DASHBOARD
app.get("/dashboard", isLoggedIn, async (req, res) => {

  const snapshot = await db.collection("tasks")
    .where("userId", "==", req.session.userId)
    .get();

  const tasks = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  res.render("dashboard", {
    userName: req.session.userName,
    tasks
  });
});

// ADD TASK
app.post("/add-task", isLoggedIn, async (req, res) => {

  const task = req.body.task;

  if (!task || task.trim() === "") {
    return res.redirect("/dashboard");
  }

  await db.collection("tasks").add({
    text: task,
    completed: false,
    userId: req.session.userId
  });

  res.redirect("/dashboard");
});

// TOGGLE TASK
app.post("/toggle-task/:id", isLoggedIn, async (req, res) => {

  const taskRef = db.collection("tasks").doc(req.params.id);
  const task = await taskRef.get();

  if (!task.exists) return res.redirect("/dashboard");

  await taskRef.update({
    completed: !task.data().completed
  });

  res.redirect("/dashboard");
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
