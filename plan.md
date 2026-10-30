# POGOH companion: phased plan

## Goal

Build a personal, phone-friendly website or app that answers two questions:

1. **When and where should I go to get an e-bike?** Show current availability,
   nearby alternatives, and useful timing patterns through graphs or a dashboard.
2. **Where should I ride, and how can I follow the route?** Make saved bike
   routes easy to browse on an iPhone and, where supported, follow on Apple Watch
   without repeatedly checking the phone.

The second handoff is background and a broad feature outline. Its route
directions, station lists, ride allowances, implementation choices, and other
specifics must be checked before they become requirements. This document is a
plan only; it does not authorize implementation or service changes.

## Principles

- Design for quick use on a phone: readable numbers, large controls, clear maps,
  and a short path from opening the app to choosing a station or route.
- Keep the new app and its services at $0. Preserve the existing logger and
  Azure spending protections; avoid adding paid services or billing-dependent keys.
- Prefer a small, understandable website first. Consider installation on the
  iPhone home screen before deciding whether a native app is necessary.
- Clearly distinguish live status, older snapshots, observed historical
  patterns, and future predictions. Do not promise that a bike will be waiting.
- Ask before changing the logger, Azure resources, GitHub settings, or adding
  an account-requiring service. Prepare a reviewable result before requesting
  approval to publish or enable hosting.

## Phase 1 — Validate the inputs and agree on the experience

- Confirm that ten-minute logging continues reliably and assess data freshness,
  gaps, and coverage before using it for timing recommendations.
- Confirm the home station, useful walking alternatives, preferred rides, and
  which features matter most for the first version.
- Sketch a mobile layout with three main areas: **Ride now**, **Best times**,
  and **Routes**. Keep the ride log available without crowding the main screen.
- Check the user's iPhone/iOS and Apple Watch/watchOS versions. Research and
  prototype the navigation handoff early, because its limits may affect route
  export and the interface.
- Validate current POGOH ride allowances and docking/re-renting rules before
  showing any ride-time or refresh-stop guidance.

**Result:** a confirmed scope, a simple screen outline, and a list of assumptions
that still need checking. Data collection continues throughout later phases.

## Phase 2 — Build the mobile foundation and current station view

- Create a responsive website with a clear home-station summary and a map of
  nearby stations: e-bikes, pedal bikes, open docks, and operating status.
- Show when the data was updated. Use a labeled latest-snapshot fallback if
  live data cannot be fetched; handle unavailable or stale data clearly.
- Make it easy to compare nearby alternatives before leaving home.
- Choose free hosting, likely the existing repository's GitHub Pages, and
  prepare a phone preview. Obtain approval before enabling hosting/settings.

**Result:** a usable phone dashboard for deciding where to find a bike now.

## Phase 3 — Add the route library and portable route files

- Start with the handoff's broad ride ideas: a Schenley ride, a river-trail
  out-and-back, and a longer river loop. Confirm their actual paths rather than
  copying the written directions unchanged.
- Give each route a map, distance, approximate duration, terrain/climbing notes,
  and an e-bike recommendation where appropriate.
- Show relevant station stops and their availability along the route. Treat
  time estimates and docking opportunities as estimates, not guarantees.
- Check generated geometry against the map, especially trail entrances,
  bridge crossings, connections between riverbanks, and one-way restrictions.
- Provide downloadable route files, such as GPX, so routes remain portable.
  Add Apple Maps links only for navigation behavior verified in Phase 1/5.

**Result:** a small set of checked, reusable routes that can be opened on a phone
and exported for compatible navigation apps.

## Phase 4 — Add availability charts and useful timing guidance

- Build a repeatable analysis process from the logged station snapshots.
- Show e-bike availability separately from availability of any bike, for the
  home station, individual backups, and the combined nearby group.
- Start with observed patterns by local weekday and time of day. Present a
  weekly heatmap and a daily graph, with sample counts and coverage information.
- Convert timestamps using `America/New_York`, including daylight saving time.
  Missing observations must never count as empty stations.
- Mark thinly sampled periods as insufficient data. Consider the number of
  distinct days/weeks represented, since adjacent snapshots are correlated.
- Once coverage supports it, summarize promising and less reliable departure
  windows and the most useful backup stations. Make the evidence visible.
- If useful data is available, add historical trip demand as a separate view.
  Trips can explain departures, arrivals, and net outflow; they cannot establish
  bike availability or account for staff rebalancing.
- Keep summary data easy to regenerate. Decide on automatic regeneration after
  the initial analysis works, without changing the logger unnecessarily.

**Result:** an honest dashboard for choosing when to look for an e-bike, with
uncertainty clearly shown while the dataset grows.

## Phase 5 — Complete the iPhone and Apple Watch navigation workflow

- Aim for the desired experience: choose a ride on the phone, start navigation,
  then follow the map and directions on Apple Watch.
- Test Apple Maps cycling directions started on iPhone and their Watch behavior.
  Separately verify whether the exact custom route can be preserved; opening a
  destination in Maps may produce a different route.
- Do not assume Apple Maps supports importing GPX cycling loops or that its
  custom walking/hiking features provide equivalent cycling navigation.
- If Apple Maps cannot preserve a route, evaluate GPX-compatible Watch apps as
  an optional alternative. State costs, account requirements, turn guidance,
  offline support, and phone-connectivity requirements before choosing one.
- Test on the user's devices: route transfer, on-watch map, turn instructions
  and haptics where supported, and behavior when the phone screen is locked.
- Document a straightforward fallback if exact custom-route Watch navigation
  cannot be achieved within the $0 constraint. Keep native Watch development
  as a later decision rather than a first-version requirement.

**Result:** a tested, clearly explained navigation path, with an honest account
of what the Watch can and cannot do for these routes.

## Phase 6 — Add the ride log and finish everyday usability

- Add a simple ride log: date, route, bike type, duration, and notes.
- Keep personal records local by default, with JSON export/import and graceful
  handling of unavailable browser storage. Explain that local data does not
  automatically sync between devices or browsers.
- Show a weekly ride count or streak to support the daily cardio goal.
- Add home-screen installation where useful, with clear offline limitations.
  Cached routes must not make old station counts appear live.
- Check phone layouts, accessibility, loading/error states, route downloads,
  data freshness, and the Watch handoff. Document maintenance and publishing.

**Result:** a practical daily companion for checking bikes, choosing a ride,
following it, and keeping a personal record.

## Phase 7 — Improve recommendations after enough data accumulates

- Revisit the analysis after several weeks of consistent coverage.
- Consider a small predictive model only if it improves on the observed table
  when evaluated on held-out weeks. Account for changing semester patterns.
- Add features such as weather or academic-calendar effects only when their
  value and free data access are established.
- Reconsider a native phone/Watch app or cross-device ride-log sync only if
  everyday use reveals a concrete need that the website cannot satisfy.

**Result:** measured improvements based on evidence and actual use, without
making the first version depend on a complex model or a native app.

## First-version completion criteria

- Opens comfortably on an iPhone and provides current or clearly dated bike status.
- Provides a checked route library with maps, useful details, and route export.
- Shows availability charts with honest coverage and insufficient-data states.
- Offers a tested Watch navigation workflow, or clearly documents the supported
  alternative and any limitations before requiring an app purchase or account.
- Includes a portable personal ride log and understandable maintenance instructions.
- Uses no new paid services and preserves the existing logger and spending controls.
