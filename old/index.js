
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue: QueueMQ, Worker, QueueScheduler } = require('bullmq');
const express = require('express');

const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { ensureLoggedIn } = require('connect-ensure-login');

passport.use(
  new LocalStrategy(function (username, password, cb) {
    if (username === 'bull' && password === 'board') {
      return cb(null, { user: 'bull-board' });
    }
    return cb(null, false);
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

const sleep = (t) => new Promise((resolve) => setTimeout(resolve, t * 1000));


const redisOptions = {
  port: 16823,
  host: 'redis-16823.c253.us-central1-1.gce.cloud.redislabs.com',
  password: 'muO3hLEXWLDFAPxEbgcq8QBcXfS1CD4e',
  tls: false,
};

const createQueueMQ = (name) => new QueueMQ(name, { connection: redisOptions });
const emailQueue = createQueueMQ('Email');
const pushQueue = createQueueMQ('Push Notification');
const smsQueue = createQueueMQ('SMS');

const app = express();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/ui');

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(pushQueue),
    new BullMQAdapter(smsQueue),
  ],
  serverAdapter,
});

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(session({ secret: 'keyboard cat', saveUninitialized: true, resave: true }));
app.use(bodyParser.urlencoded({ extended: false }));

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize({}));
app.use(passport.session({}));

app.get('/ui/login', (req, res) => {
  res.render('login', { invalid: req.query.invalid === 'true' });
});

app.post(
  '/ui/login',
  passport.authenticate('local', { failureRedirect: '/ui/login?invalid=true' }),
  (req, res) => {
    res.redirect('/ui');
  }
);


app.use('/ui', ensureLoggedIn({ redirectTo: '/ui/login' }), serverAdapter.getRouter());

const port = process.env.PORT || 3000

app.listen(port, (err, res) => {
    if (err) {
        console.log(err)
        return res.status(500).send(err.message)
    } else {
        console.log('[INFO] Server Running on port:', port)
    }
})

