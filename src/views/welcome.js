import * as sqlite from '../services/sqlite.js'
import * as utils from '../utils.js'

export function get (_req, res) {
  const now = new Date()
  const trips = sqlite.all(`
    SELECT title, location, start_time, end_time, clubs.name as club
    FROM trips
    LEFT JOIN clubs on trips.club = clubs.id
    WHERE start_time > ? AND private = 0
    ORDER BY start_time ASC
    LIMIT 5
  `, now.getTime())
    .map(trip => {
      return {
        ...trip,
        icon_path: utils.getClubIcon(trip.club),
        datetime_range: utils.getDatetimeRangeElement(trip.start_time, trip.end_time)
      }
    })

  res.render('views/welcome.njk', { trips })
}
