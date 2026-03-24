# Admin Mobile V2 Plan

## Goal

Build a true mobile-first admin PWA V2 that feels like a small operating system:

- a launcher/home screen
- several "apps" inside the same mobile shell
- each app isolated in its own file/module
- notifications that can still reopen the correct app/view on iPhone
- easy to extend later with new apps like `Gestion des Stocks`

V1 stays intact.
V2 lives in a separate app folder.

## Recommendation

Do **not** continue growing V1 in place.

Create a new sibling app:

- `pizzeria-admin-mobile` = V1 kept stable
- `pizzeria-admin-mobile-v2` = new mobile OS-style app

This is cleaner than a single huge `App.jsx`, and safer for deployment.

## What We Can Really Build

With a PWA on iPhone added to the home screen, we can reliably aim for:

- a launcher with app icons
- app-by-app navigation
- deep links like `/?app=click-collect&view=tickets`
- Web Push notifications opening the correct app/view
- an app shell cached by service worker
- a native-feeling mobile layout

What we should **not** pretend to have:

- true iOS native multi-window app switching
- several independent iPhone apps from one web app install
- full native OS background behavior outside PWA/browser limits

So the right mental model is:

`one installed PWA` that behaves like `a mini admin OS`, with internal apps.

## V2 Product Shape

### Shell

The shell is the permanent system layer:

- status bar / top chrome
- launcher
- app opening/closing
- notifications center
- session/auth state
- service worker registration
- realtime connection state
- routing / deep links

### Internal Apps

Each app becomes a self-contained module:

- `Click&Collect`
- `Infos Clients`
- `Gestion des Stocks`
- future apps later

Each app owns:

- its screens
- its data loaders
- its filters
- its actions
- its tiny local state

The shell should not know app business logic.

## Recommended Folder Structure

Create:

`pizzeria-admin-mobile-v2/`

Inside:

```text
src/
  app/
    AppShell.jsx
    AppRouter.jsx
    Launcher.jsx
    SystemMenu.jsx
    NotificationCenter.jsx
    app-registry.js
  apps/
    click-collect/
      index.js
      ClickCollectApp.jsx
      routes.js
      components/
      hooks/
      api/
    customer-info/
      index.js
      CustomerInfoApp.jsx
      routes.js
      components/
      hooks/
      api/
    stock/
      index.js
      StockApp.jsx
      routes.js
      components/
      hooks/
      api/
  shared/
    components/
    hooks/
    lib/
    styles/
    utils/
  services/
    auth/
    realtime/
    notifications/
    pwa/
  main.jsx
```

## App Registry Pattern

This is the key to making the "OS" easy to evolve.

We keep one central registry:

```js
export const appRegistry = [
  {
    id: "click-collect",
    name: "Click&Collect",
    icon: "/apps/click-collect.png",
    route: "click-collect",
    notificationScope: ["orders", "tickets"],
    component: ClickCollectApp,
  },
  {
    id: "customer-info",
    name: "Infos Clients",
    icon: "/apps/customer-info.png",
    route: "customer-info",
    notificationScope: ["customers"],
    component: CustomerInfoApp,
  },
];
```

Benefits:

- add/remove an app in one place
- launcher is automatic
- deep-link handling is automatic
- notification routing is automatic
- permissions can be attached per app later

## Routing Model

Keep routing simple and URL-driven.

Example:

- `/?app=click-collect`
- `/?app=click-collect&view=orders`
- `/?app=click-collect&view=tickets`
- `/?app=customer-info`
- `/?app=stock&view=inventory`

Why this is important:

- push notifications can open the exact screen
- launcher state is restorable after reopen
- debugging is easier
- no heavy routing library is required at first

## Notifications Strategy

## Server Side

Keep the backend as the source of truth for real push events:

- order prep at `pickup - 30 min`
- ticket print failures
- future stock alerts later

Payloads should always include:

- `title`
- `body`
- `tag`
- `url`
- `app`
- `view`
- optional business ids like `orderId`

Example:

```json
{
  "title": "3 commandes a preparer pour 20:00",
  "body": "Ouvrez Click&Collect pour traiter la file.",
  "tag": "orders-prep-20-00",
  "url": "/?app=click-collect&view=orders",
  "app": "click-collect",
  "view": "orders"
}
```

## Client Side

The service worker must stay generic:

- receive push
- show notification
- navigate to `payload.url`

Do not put app business logic inside the service worker.

## In-App Notices

Keep separate from push:

- small temporary UI notices
- scoped to the active app/view
- auto-dismiss

So:

- push = background / lock screen / reopen app
- in-app notice = live UI feedback

## Realtime Strategy

Keep SSE/live stream as a shared platform service:

- one realtime connection in the shell
- shared event bus inside V2
- apps subscribe only to the events they need

Example:

- shell opens SSE
- `Click&Collect` listens to `orders:admin-updated` and `tickets:admin-updated`
- `Infos Clients` ignores them
- future `Stock` app listens to stock events only

This avoids opening one SSE connection per app.

## State Strategy

Use a layered model:

### System State

Owned by shell:

- auth/session
- active app
- current view
- menu state
- push permission/subscription state
- realtime connected/disconnected

### App State

Owned inside each app:

- filters
- selected item
- draft form
- local loading/error state

### Shared Query Helpers

Centralize low-level API calls in `services/` or `shared/lib/api/`.
But keep app-specific mapping inside each app.

## UI Direction

The V2 should feel like:

- one mobile device
- one launcher
- compact cards and lists
- fast thumb navigation
- no desktop leftovers

Recommended shell visuals:

- launcher grid
- fixed safe-area aware top system bar
- slide-up app opening transitions
- compact dropdown system menu
- subtle badges on app icons when something needs attention

Important:

- no giant page titles everywhere
- no repeated explanatory paragraphs
- no web-admin feeling

## Notification Badges on Launcher

We can support two badge layers:

### In-app badges

Fully under our control:

- red dot on `Click&Collect`
- counter badge like `3`
- per-app urgency state

### OS-level icon badge

Treat as optional and platform-dependent.
Do not make the product depend on it.

So the V2 UX should always remain good even if only in-app badges are visible.

## Migration Strategy

### Phase 0

Freeze V1 except bug fixes.

### Phase 1

Create `pizzeria-admin-mobile-v2` with only:

- auth
- launcher
- shell
- push registration
- realtime connection
- empty app registry

### Phase 2

Build `Click&Collect` first inside V2:

- orders
- tickets
- order detail modal
- new order builder
- ticket reprint actions

### Phase 3

Build `Infos Clients`:

- customer search
- customer detail
- useful order/contact info

### Phase 4

Build `Gestion des Stocks`:

- inventory overview
- low stock alerts
- item detail

### Phase 5

Refine launcher:

- icon badges
- deep links
- smoother app transitions
- cleaner system menu

### Phase 6

Deploy V2 in parallel with V1.
Only retire V1 after functional parity for the wanted apps.

## First Technical Decisions

These are the decisions I recommend locking now:

1. V2 in a separate folder: `pizzeria-admin-mobile-v2`
2. One shell + app registry
3. One service worker for the whole V2
4. One realtime connection shared by the shell
5. Each internal app gets its own folder and main component
6. URL-based deep linking from notifications
7. V1 kept stable during the migration

## Concrete Todo For The Start

1. Create `pizzeria-admin-mobile-v2`
2. Copy only the minimal PWA foundations from V1:
   - `vite`
   - `manifest`
   - `sw.js`
   - auth helpers
   - realtime helper
   - push helper
3. Build `AppShell`
4. Build `app-registry.js`
5. Build `Launcher`
6. Build the first empty app container for `Click&Collect`
7. Build the first empty app container for `Infos Clients`
8. Wire URL deep linking
9. Reconnect push open behavior to the right app/view
10. Start migrating `Click&Collect` screens one by one

## Recommended Next Move

The clean next step is:

- create `pizzeria-admin-mobile-v2`
- scaffold the shell + registry + launcher
- migrate only `Click&Collect` first

That gives us a real V2 foundation instead of stretching V1 further.
