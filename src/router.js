import { Router } from 'express'

import * as index from './rest/index.js'
import * as sqlite from './services/sqlite.js'
import * as tripView from './views/trip.js'
import * as vehicleRequestView from './views/vehicle-request.js'
import * as myTripsView from './views/my-trips.js'
import * as requestsView from './views/trip-requests.js'

import signS3 from './services/s3.js'
import { requireAuth, requireAnyLeader, requireOpo, signinCAS, logout } from './services/authentication.js'

const router = Router()

// Helper function makes it easy to declare new views
router.enableView = function (path, access) {
  const renderPath = (_req, res) => res.render(`views${path}.njs`)
  switch (access) {
    case 'public':
      this.route(path).get(renderPath)
      break
    case 'auth':
      this.route(path).get(requireAuth, renderPath)
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
  const url = is_opo === 1 ? '/opo/trip-approvals' : '/welcome'
  res.redirect(url)
})

router.get('/public-trips', index.get)

router.get('/signin-cas', signinCAS)
router.post('/logout', requireAuth, logout)

// Basic views
router.enableView('/welcome', 'public')
router.enableView('/all-trips', 'auth')
router.enableView('/profile', 'auth')
router.enableView('/opo/calendar', 'opo')
router.enableView('/opo/manage-fleet', 'opo')
router.enableView('/opo/profile-approvals', 'opo')
router.enableView('/opo/trip-approvals', 'opo')
router.enableView('/opo/vehicle-requests', 'opo')

// Somewhat more complicated views
router.route('/my-trips').get(requireAuth, myTripsView.get)
router.route('/create-trip').get(requireAuth, requireAnyLeader, tripView.getCreateView)
router.route('/trip/:tripId').get(requireAuth, tripView.getSignupView)
router.route('/trip/:tripId/edit').get(requireAuth, tripView.getEditView)
router.route('/trip/:tripId/requests').get(requireAuth, requestsView.getRequestsView)
router.route('/vehicle-request/:vehicleRequestId').get(requireAuth, vehicleRequestView.getVehicleRequestView)
router.route('/leader/trip/:tripId').get(requireAuth, tripView.getLeaderView)

export default router
