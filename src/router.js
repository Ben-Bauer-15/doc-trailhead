import { Router } from 'express'

import * as index from './rest/index.js'
import * as assignments from './rest/assignments.js'
import * as sqlite from './services/sqlite.js'
import * as tripView from './views/trip.js'
import * as profileView from './views/profile.js'
import * as tripStatusView from './views/trip-status.js'
import * as vehicleRequestView from './views/vehicle-request.js'
import * as allTripsView from './views/all-trips.js'
import * as myTripsView from './views/my-trips.js'
import * as requestsView from './views/trip-requests.js'

import * as tripApprovalsView from './views/opo/trip-approvals.js'
import * as vehicleRequestsView from './views/opo/vehicle-requests.js'

import signS3 from './services/s3.js'
import * as authentication from './services/authentication.js'
const { requireAuth, requireAnyLeader, requireTripLeader, requireOpo } = authentication

const router = Router()

// Helper function makes it easy to declare new views
router.enableRender = (path) => router.get(`/${path}`, (_req, res) => res.render(`${path}.njk`))
router.enableView = function (path, access) {
  const renderPath = (_req, res) => res.render(`views${path}.njk`)
  switch (access) {
    case 'public':
      this.route(path).get(renderPath)
      break
    case 'any-leader':
      this.route(path).get(requireAuth, requireAnyLeader, renderPath)
      break
    case 'opo':
      this.route(path).get(requireAuth, requireOpo, renderPath)
      break
    default:
      throw new Error('Incorrect usage of enableView method')
  }
}

router.get('/sign-s3', signS3)

router.get('/', requireAuth, (req, res) => {
  const is_opo = sqlite.get('SELECT is_opo FROM users WHERE id = ?', req.user)?.is_opo
  const url = is_opo === 1 ? '/opo/trip-approvals' : '/all-trips'
  res.redirect(url)
})

router.get('/public-trips', index.get)

router.get('/signin-cas', authentication.signinCAS)
router.post('/logout', requireAuth, authentication.logout)

// Basic views
// TODO refactor these into templates
router.enableView('/welcome', 'public')
router.enableView('/opo/manage-fleet', 'opo')
router.enableView('/opo/profile-approvals', 'opo')

// All the other views
// TODO refactor all the router.route into router.get, router.post, etc.
router.route('/my-trips').get(requireAuth, myTripsView.get)
router.route('/create-trip').get(requireAuth, requireAnyLeader, tripView.getCreateView)
router.route('/new-user').get(requireAuth, profileView.getNewUserView)
router.get('/all-trips', requireAuth, allTripsView.get)

router.get('/opo/vehicle-requests', requireAuth, requireOpo, vehicleRequestsView.get)
router.route('/opo/trip-approvals').get(requireAuth, requireOpo, tripApprovalsView.get)

router.route('/trip/:tripId').get(requireAuth, tripView.getSignupView)
router.route('/trip/:tripId/edit').get(requireAuth, requireTripLeader, tripView.getEditView)
router.route('/trip/:tripId/check-out').get(requireAuth, requireTripLeader, tripStatusView.getCheckOutView)
router.route('/trip/:tripId/check-in').get(requireAuth, requireTripLeader, tripStatusView.getCheckInView)
router.route('/trip/:tripId/requests').get(requireAuth, requireTripLeader, requestsView.getRequestsView)
router.route('/trip/:tripId/user/:userId').get(requireAuth, requireTripLeader, tripView.getUserView)

router.route('/profile').get(requireAuth, profileView.getProfileView)

router.route('/vehicle-request/:vehicleRequestId').get(requireAuth, vehicleRequestView.getVehicleRequestView)
router.route('/leader/trip/:tripId').get(requireAuth, requireTripLeader, tripView.getLeaderView)

router.route('/opo/calendar').get(requireAuth, requireOpo, (_req, res) => {
  res.render('views/opo/calendar.njk', { LICENSE_KEY: process.env.FULLCALENDAR_LICENSE })
})

// Some components
router.enableRender('components/save-button')

// Look, JSON APIs! See, I'm not a zealot
router.get('/json/calendar', requireAuth, requireOpo, assignments.get)

// Developer routes
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-login', authentication.devLogin)
}

export default router
