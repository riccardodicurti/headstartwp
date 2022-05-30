require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const Redis = require('ioredis');
const RedisStore = require('connect-redis')(session);

const { existsSync } = require('fs');
const authRouter = require('../routes/auth');

const redisClient = new Redis(
	`rediss://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
);

const staticPath = existsSync(path.join(__dirname, '../_docs'))
	? path.join(__dirname, '../_docs')
	: path.join(__dirname, '_docs');

if (!existsSync(staticPath)) {
	console.warn('No docs found at, run `npm run typedoc` from root', staticPath);
}

const app = express();
const port = process.env.PORT || 8080;

app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

app.use(
	session({
		store: new RedisStore({ client: redisClient }),
		secret: 'keyboard cat',
		resave: false,
		saveUninitialized: false,
	}),
);
app.use(passport.authenticate('session'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', authRouter);
app.use('/', passport.authenticate('session'));
app.use('/', (req, res, next) => {
	if (req.user) {
		console.log('Serving docs from', staticPath);
		return express.static(staticPath)(req, res, next);
	}
	return res.render('login');
});
app.listen(port);

console.log(`Server started at http://localhost:${port}`);
