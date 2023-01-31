{% include "common/site-head.njs" %}
<title>Trips - DOC Trailhead</title>
<link rel="stylesheet" href="/static/css/all-trips.css">

{% include "common/site-nav.njs" %}
<main>

<section class="info-card">
<img src="/static/icons/mountain-icon.svg">
<h1>Explore Trips</h1>
</section>

<section class="trips" hx-get="/rest/all-trips" hx-swap=innerHTML hx-trigger=load>
</section>

</main>

