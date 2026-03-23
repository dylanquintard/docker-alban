# Pizzeria Admin Mobile

Mini application web mobile admin / PWA pour suivre les commandes depuis un iPhone ou un navigateur mobile.

## Fonctionnalites

- login admin
- liste des commandes groupees par creneau
- detail de commande
- validation / annulation de commande
- rafraichissement temps reel via SSE
- socle PWA avec manifest + service worker
- prompt d'activation des notifications navigateur

## Lancement local

```bash
npm install
npm run dev
```

Depuis un iPhone sur le meme reseau local, l'app utilise automatiquement l'IP de la machine qui sert Vite (port API `5000`) si `VITE_API_BASE_URL` n'est pas defini.

## Build production

```bash
npm run build
```

Le build sort dans `dist/`.

## Variables d'environnement

Copier `.env.example` vers `.env` puis adapter si besoin :

- `VITE_API_BASE_URL`
- `VITE_REALTIME_STREAM_URL`

## Deploiement VPS

1. Build de l'application
2. Servir `dist/` sur le VPS avec HTTPS
3. Autoriser le domaine dans `CORS_ORIGINS` du backend
4. Ouvrir l'app sur iPhone dans Safari
5. Faire `Partager -> Ajouter a l'ecran d'accueil`

## Notifications iPhone

Le service worker est pret pour le push web.

Important :
- iOS demande une installation sur l'ecran d'accueil pour les web notifications
- la demande de permission doit etre declenchee par une action utilisateur
- le push serveur restera a brancher plus tard sur l'API/VPS
