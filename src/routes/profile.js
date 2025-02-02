export function getProfileView (req, res) {
  if (req.query.card) {
    return getProfileCard(req, res)
  }

  const data = getProfileData(req, req.user)
  return res.render('views/profile.njk', data)
}

export function getNewUserView (req, res) {
  const data = getProfileData(req, req.user)
  return res.render('views/new-user.njk', data)
}

export function getProfileCard (req, res) {
  const data = getProfileData(req, req.user)
  return res.render('profile/profile-card.njk', data)
}

export function getProfileCardEditable (req, res) {
  const data = getProfileData(req, req.user)
  return res.render('profile/profile-card-editable.njk', data)
}

export function getUserTripView (req, res) {
  const data = getProfileData(req, req.params.userId, true)
  return res.render('views/profile.njk', data)
}

function getProfileData (req, userId, hideControls) {
  const user = req.db.get('SELECT * FROM users WHERE id = ?', userId)
  const certs = req.db
    .all('SELECT cert, is_approved FROM user_certs WHERE user = ?', userId)
    .map(item => `${item.cert}${item.is_approved === 0 ? ' (pending)' : ''}`)
    .join(', ')

  if (user.shoe_size) {
    const split = user.shoe_size.split('-')
    user.shoe_size_sex = split[0]
    user.shoe_size_num = split[1]
  }

  user.feet = Math.floor(user.height_inches / 12)
  user.inches = user.height_inches % 12
  user.height = `${user.feet}'${user.inches}"`

  user.driver_certifications = certs.length > 0 ? certs : 'none'
  user.leader_for = req.db.get(`
    SELECT group_concat(
      iif(is_approved = 1, name, name || ' (pending)'),
      ', '
    ) as clubs
    FROM club_leaders
    LEFT JOIN clubs ON club_leaders.club = clubs.id
    WHERE user = ?
  `, userId)?.clubs || 'none'
  user.hide_controls = hideControls
  return user
}

export function post (req, res) {
  const formData = { ...req.body }
  formData.user_id = req.user
  const { shoe_size_sex, shoe_size_num, feet, inches } = formData
  formData.shoe_size = shoe_size_sex && shoe_size_num ? `${shoe_size_sex}-${shoe_size_num}` : null
  formData.height_inches = (parseInt(feet) * 12) + parseInt(inches)

  req.db.run(`
    UPDATE users
    SET
      name = @name,
      email = @email,
      pronoun = @pronouns,
      dash_number = @dash_number,
      clothe_size = @clothe_size,
      shoe_size = @shoe_size,
      height_inches = @height_inches,
      allergies_dietary_restrictions = @allergies_dietary_restrictions,
      medical_conditions = @medical_conditions
    WHERE id = @user_id
  `, formData)

  if (formData.new_user === 'true') {
    return res.redirect(303, '/all-trips')
  }

  return getProfileCard(req, res)
}

const VALID_CERTS = ['VAN', 'MICROBUS', 'TRAILER']
export function getDriverCertRequest (req, res) {
  const userId = req.user
  const driver_certs = req.db.all('SELECT cert, is_approved FROM user_certs WHERE user = ?', userId)
  const checkboxes = VALID_CERTS.map(cert => {
    const userCert = driver_certs.find(item => item.cert === cert)
    const attributes = userCert ? `checked ${userCert.is_approved ? 'disabled ' : ''}` : ''
    return `<label><input ${attributes}type=checkbox name=cert value=${cert}></input>${cert}</label>`
  })
  const form = `
<form hx-boost=true
      hx-push-url=false
      action=/profile/driver-cert
      method=post class="driver-cert">
<div class="checkbox-row">${checkboxes.join('\n')}</div>
<div class="button-row">
  <button class="action deny" hx-get="/profile?card=true">Cancel</button>
  <button class="action approve" type=submit>Save</button>
</div>
</form>
  `
  res.send(form).status(200)
}

export function postDriverCertRequest (req, res) {
  // Delete all the *pending* requests so that we can add the new pending requests
  req.db.run('DELETE FROM user_certs WHERE user = ? and is_approved = 0', req.user)

  // If the body is empty, that means the user has removed their certs, and we're done
  if (!req.body.cert) return getProfileCard(req, res)

  // body-parser weirdness: if there's a single value it's a string, if there's multiple it's an
  // array of strings
  const certs = typeof req.body.cert === 'string' ? [req.body.cert] : req.body.cert
  certs
    .filter(cert => VALID_CERTS.includes(cert))
    .map(cert => req.db.run(
      'INSERT OR IGNORE INTO user_certs (user, cert, is_approved) VALUES (?, ?, false)',
      req.user, cert
    )) // INSERT OR IGNORE so that existing, approved certs will not be overwritten

  return getProfileCard(req, res)
}

export function getClubLeadershipRequest (req, res) {
  const userClubs = req.db.all(`
    SELECT clubs.id, name, is_approved
    FROM club_leaders
    LEFT JOIN clubs ON clubs.id = club_leaders.club
    WHERE user = ?
    ORDER BY name
  `, req.user)
  const clubsWithoutUser = req.db.all(`
    SELECT id, name
    FROM clubs
    WHERE active = 1 AND NOT EXISTS
      (SELECT *
      FROM club_leaders AS cl
      WHERE user = ? AND cl.club = clubs.id
      )
    ORDER BY name
  `, req.user)

  const clubListItems = userClubs.map(club => `
  <li>${club.name}${club.is_approved === 0 ? ' (pending)' : ''}
  <button
          hx-delete="/profile/club-leadership/${club.id}"
          hx-confirm="Are you sure you want to remove yourself as a${club.is_approved === 0 ? ' (pending)' : ''} leader of ${club.name}?"
          hx-target="closest li"
          hx-swap="outerHTML"
  ><img src="/static/icons/close-icon.svg"></button>
  `)
  const options = clubsWithoutUser.map(club => `<option value=${club.id}>${club.name}</option>`)
  const form = `
<form hx-boost=true
      hx-push-url=false
      action=/profile/club-leadership
      method=post class="club-leadership-request">
<ul>${clubListItems.join(' ')}</ul>
<div>
  <select name=club>${options}</select>
  <button class="action approve" type=submit>Request</button>
</div>
  <button class="action deny" hx-get="/profile?card=true">Close</button>
</form>
  `
  res.send(form).status(200)
}

export function postClubLeadershipRequest (req, res) {
  const club = req.body.club
  if (!club) return res.sendStatus(400)

  req.db.run('INSERT INTO club_leaders (user, club, is_approved) VALUES (?, ?, false)', req.user, club)
  return getProfileCard(req, res)
}

export function deleteClubLeadershipRequest (req, res) {
  if (!req.params.id) return res.sendStatus(400)

  const { changes } = req.db
    .run('DELETE FROM club_leaders WHERE user = ? AND club = ?', req.user, req.params.id)

  if (changes < 1) return res.sendStatus(400)
  return res.send('').status(200)
}
