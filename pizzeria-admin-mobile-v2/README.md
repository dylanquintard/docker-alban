# pizzeria-admin-mobile-v2

Base V2 de l'application mobile admin:

- shell type "mini OS"
- launcher d'applications
- registre central des apps
- deep links `?app=...&view=...`
- base PWA et service worker

## Demarrage

```bash
npm install
npm run dev
```

## Structure

- `src/app/` : shell, launcher, routing, menu systeme
- `src/apps/` : apps internes
- `src/services/` : auth, realtime, notifications, PWA
- `src/shared/` : composants et utilitaires partages
