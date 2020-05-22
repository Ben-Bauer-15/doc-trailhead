import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import apiRouter from './router';
import { mailer, scheduler } from './services';
import * as constants from './constants';
import { tokenForUser } from './controllers/user-controller';
import Trip from './models/trip-model';


const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost/doc-planner';
mongoose.set('useCreateIndex', true);

mongoose.connect(mongoURI, { useNewUrlParser: true });
// set mongoose promises to es6 default
mongoose.Promise = global.Promise;

mongoose.model('Assignment');

dotenv.config({ silent: true });

// initialize
const app = express();

// enable/disable cross origin resource sharing if necessary
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.use('/api', apiRouter);

// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
app.listen(port);

const sendCheckOutEmail = () => {
  console.log('executing checkout send');
  const today = new Date();
  Trip.find({}).populate('leaders').then((trips) => {
    trips.forEach((trip) => {
      console.log('startDate', trip.startDate.getTime());
      console.log('today', today.getTime());
      console.log('in the future', ((trip.startDate > today)));
      console.log('less than 48', trip.startDate.getTime() - today.getTime() <= (48 * (3600000)));
      console.log('more than 24', trip.startDate.getTime() - today.getTime() >= (24 * (3600000)));
      if ((trip.startDate > today) && (trip.startDate.getTime() - today.getTime() <= (48 * 3600000)) && (trip.startDate.getTime() - today.getTime() >= (24 * 3600000))) {
        console.log('should send email');
        const leaderEmails = trip.leaders.map((leader) => { return leader.email; });
        console.log(trip.leaders[0]._id);
        mailer.send({ address: leaderEmails, subject: `Trip #${trip.number} is happening soon`, message: `Hello,\n\nYou're Trip #${trip.number}: ${trip.name} is happening in 48 hours!\n\nView the trip here: ${constants.frontendURL}/trip/${trip._id}\n\nIMPORTANT: on the day of the trip, you must mark all attendees here: ${constants.frontendURL}/trip-check-out/${trip._id}?token=${tokenForUser(trip.leaders[0], 'mobile', trip._id)}\n\nBest,\nDOC Planner` });
      }
    });
  });
};

const sendCheckInEmail = () => {
  console.log('executing checkin send');
  const today = new Date();
  Trip.find({}).populate('leaders').then((trips) => {
    trips.forEach((trip) => {
      console.log('endDate', trip.endDate.getTime());
      console.log('today', today.getTime());
      console.log('less than 48', trip.endDate.getTime() - today.getTime() >= (48 * (3600000)));
      console.log('more than 24', trip.endDate.getTime() - today.getTime() >= (24 * (3600000)));
      if ((trip.endDate > today) && (trip.endDate.getTime() - today.getTime() < (48 * 3600000)) && (trip.endDate.getTime() - today.getTime() > (24 * 3600000))) {
        console.log('should send email');
        const leaderEmails = trip.leaders.map((leader) => { return leader.email; });
        console.log(trip.leaders[0]._id);
        mailer.send({ address: leaderEmails, subject: `Trip #${trip.number} should be returning soon`, message: `Hello,\n\nYou're Trip #${trip.number}: ${trip.name} is should return soon. If an EMERGENCY occured, please get emergency help right away, and follow the link below to mark your status so OPO staff is informed.\n\nIMPORTANT: right after you return, you must check-in all attendees here: ${constants.frontendURL}/trip-check-in/${trip._id}?token=${tokenForUser(trip.leaders[0], 'mobile', trip._id)}\n\nBest,\nDOC Planner` });
      }
    });
  });
};

// sendCheckOutEmail();
// sendCheckInEmail();

scheduler.schedule(sendCheckInEmail, 'minutely');
scheduler.schedule(sendCheckOutEmail, 'minutely');
scheduler.schedule(null, 'dnajndjad');

console.log(`listening on: ${port}`);
