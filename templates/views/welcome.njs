{% include "common/site-head.njs" %}
<title>DOC Trailhead</title>
<link rel="stylesheet" href="/static/css/index.css">

<section id=login>
<div class=login-card>
<div><img src="/static/icons/tree-icon.svg" alt="Vector image of a few trees"></div>
<h2>Hello Traveler!</h2>
<p>Welcome to Trailhead, the Dartmouth Outing Club and Outdoor Programs Office's digital platform.
Come and find some upcoming hikes to Balch Hill or visits to the Norwich farmer's market. On
Trailhead you can browse trips, sort by date, activity, or required experience, and create and
publish your own trips as a leader. See you in the out o’ doors!
<form action="/signin-cas"><button>Enter Trailhead via SSO</button></form>
</div>
</section>

<section id=up-next>
<h1>Up Next</h1>
</section>

<script>
fetch('/public-trips')
  .then(res => res.text())
  .then(html => { document.getElementById('up-next').insertAdjacentHTML('beforeend', html) })
</script>
