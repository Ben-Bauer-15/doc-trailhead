{% include "common/site-head.njs" %}
<title>Edit Trip {{ trip.id }} - DOC Trailhead</title>
<link rel="stylesheet" href="/static/css/trip-form.css">

{% include "common/site-nav.njs" %}

<main>
<a href="/leader/trip/{{trip.id}}" class=top-link>Back to trip #{{trip.id}}</a>
{% include "trip/trip-form.njs" %}
</main>
