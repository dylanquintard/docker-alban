# V2 Migration Sprints

## Goal

Build a V2 that separates:

- public website + client/user area
- web admin panel on `admin.eazytoolz.site`
- mobile admin app later, out of scope for now

Main rule:

- no production break
- no backend rewrite at the start
- no database split at the start
- old `/admin` stays available until the new admin is validated

## Target Architecture

- `eazytoolz.site`: public website + client area
- `api.eazytoolz.site`: shared backend API
- `admin.eazytoolz.site`: new web admin V2
- `pizzeria-admin-mobile`: postponed and redesigned later

## Delivery Strategy

1. Build the new admin web app in parallel.
2. Keep the current `/admin` routes alive during migration.
3. Migrate admin features screen by screen.
4. Validate the new admin on real production data.
5. Cut over only when parity is good enough.
6. Remove legacy `/admin` from the public front at the end.

## Sprint 0 - Framing

### Objective

Freeze the V2 scope and avoid rebuilding the wrong thing.

### Deliverables

- complete inventory of current `/admin` pages
- classification of each page:
  - move to new admin web
  - keep on public/client app
  - postpone to mobile later
  - remove
- final V2 navigation map
- final domain plan:
  - public
  - api
  - admin

### Decisions to lock

- commands, tickets, clients removed from web admin V2
- mobile app excluded from current migration scope
- same backend and same database kept for the first V2 release

### Exit Criteria

- no ambiguity left on what belongs to V2
- no ambiguity left on what stays out of scope

## Sprint 1 - Technical Foundations

### Objective

Create the new web admin app without touching production behavior.

### Deliverables

- new admin web app scaffold inside the current repo
- separate build and Docker setup
- separate Dokploy service
- domain target ready for `admin.eazytoolz.site`
- shared API connection to the existing backend
- auth, CORS, cookies and CSRF strategy validated for admin subdomain

### Work Items

- create new admin front app
- define env variables for admin app
- add Dockerfile and deployment config
- configure `admin.eazytoolz.site`
- test admin login against current API

### Risks

- cookie behavior across subdomains
- admin auth guards
- mixed public/admin assumptions in current front code

### Exit Criteria

- empty admin app deploys successfully
- admin login works against prod-like backend

## Sprint 2 - Core Admin Migration

### Objective

Move the highest-value operational pages first.

### Deliverables

- dashboard or home screen for admin V2
- `Info site`
- `Timeslots`
- `Locations`

### Work Items

- migrate layout and navigation shell
- migrate shared form patterns
- migrate site settings workflows
- migrate timeslot and location management
- test create, edit, delete, upload, translation, and publish flows

### Exit Criteria

- daily configuration work can be done from admin V2
- no need to use old `/admin` for site settings, hours or locations

## Sprint 3 - Content Admin Migration

### Objective

Move editorial and catalog management into the new admin.

### Deliverables

- `Categories`
- `Products`
- `Gallery`
- `FAQ`
- `Blog`

### Work Items

- migrate product and category screens
- migrate gallery and image usage flows
- migrate FAQ management
- migrate blog management
- validate dynamic FAQ and dynamic SEO dependencies still work

### Exit Criteria

- all web-admin content workflows are operational in admin V2
- no editorial dependency remains on legacy `/admin`

## Sprint 4 - Public / Client Separation

### Objective

Clean the public front so it no longer carries admin behavior.

### Deliverables

- removal of `/admin` routes from the public app
- removal of admin navigation from public app
- cleanup of shared admin-only code in public bundle
- public/client app kept focused on customer flows only

### Work Items

- remove admin routes from public router
- remove admin pages from public build
- clean shared dependencies and guards
- verify customer account area still works

### Risks

- hidden dependencies between public pages and admin code
- bundle regressions after route removal

### Exit Criteria

- public app contains no admin panel
- admin is available only on `admin.eazytoolz.site`

## Sprint 5 - Cutover and Stabilization

### Objective

Switch usage to V2 safely and keep rollback simple.

### Deliverables

- admin V2 deployed on production
- internal validation checklist executed
- rollback plan documented
- old `/admin` retired after observation window

### Work Items

- deploy admin V2
- perform smoke tests on real data
- keep old `/admin` available during short fallback period
- monitor errors and missing workflows
- remove legacy admin once stable

### Exit Criteria

- team uses only `admin.eazytoolz.site`
- no critical workflow requires legacy `/admin`

## Sprint 6 - Post-V2 Cleanup

### Objective

Finish the migration cleanly and prepare the next phase.

### Deliverables

- legacy admin code cleanup
- documentation updated
- deployment docs updated
- backlog prepared for mobile redesign

### Work Items

- remove dead code and stale components
- update README and deployment docs
- update env examples if needed
- document remaining mobile backlog

### Exit Criteria

- repo is clean enough to continue V2 work
- next phase is clearly prepared

## Backlog Excluded From Current V2

- mobile admin redesign
- moving commands, tickets and clients into the mobile app
- backend rewrite
- database split
- repo split

## Recommended Order Of Admin Pages

### Move early

- login
- site info
- timeslots
- locations
- categories
- products
- gallery
- faq
- blog

### Remove from web admin for now

- commands
- tickets
- clients

### Keep in public/client side

- public pages
- customer auth
- customer ordering flows
- customer profile and order history, unless explicitly redesigned later

## Go / No-Go Rule

Do not remove legacy `/admin` until these are true:

- admin V2 is deployed
- admin login is stable
- site info works
- timeslots work
- locations work
- catalog works
- gallery works
- FAQ works
- blog works
- rollback remains possible

## Suggested Execution Rhythm

- Sprint 0: cadrage only
- Sprint 1: foundations
- Sprint 2: operational admin
- Sprint 3: content admin
- Sprint 4: public/admin split
- Sprint 5: cutover
- Sprint 6: cleanup

If you want to reduce risk even more:

- keep Sprint 2 and Sprint 3 separate
- do not merge Sprint 4 into Sprint 5

