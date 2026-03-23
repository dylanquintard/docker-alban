# Pizzeria Docker Stack

Cette racine orchestre les 4 projets du dossier :

- `pizzeria-backend` : API Express + Prisma + uploads + worker d'impression.
- `pizzeria-web-service-front` : front public React/Vite servi par un serveur Node SEO.
- `pizzeria-admin-web` : nouveau panel admin web V2, compact et mobile-friendly.
- `pizzeria-admin-mobile` : PWA admin mobile React/Vite servie par Nginx.
- `pizzeria-print-agent` : agent local pour imprimantes ESC/POS, avec spool SQLite.

## Architecture cible

Le socle Docker couvre :

- `postgres` pour la base de donnees Prisma.
- `redis` pour le rate limiting distribue du backend.
- `backend` pour l'API HTTP.
- `backend-worker` pour le scheduler d'impression.
- `frontend` pour le site public.
- `admin-web` pour le nouveau back-office web V2.
- `admin-mobile` pour l'interface mobile admin.
- `print-agent` en service optionnel via le profil `print-agent`.

## Lancement local

1. Copier `.env.example` vers `.env`.
2. Completer au minimum `JWT_SECRET`.
3. Ajuster les URLs, le SMTP et les variables d'impression si besoin.
4. Lancer la stack :

```powershell
docker compose -f compose.yaml -f compose.local.yaml up -d --build
```

Avec l'agent d'impression :

```powershell
docker compose -f compose.yaml -f compose.local.yaml --profile print-agent up -d --build
```

Acces local par defaut :

- site public : `http://localhost:8000`
- API backend : `http://localhost:5000`
- admin web V2 : `http://localhost:4174`
- admin mobile : `http://localhost:4173`
- sante print agent : `http://localhost:3000/health`

## Base de donnees et dump SQL

La base Docker est creee dans le conteneur `postgres`. Si vous avez deja un dump SQL :

1. Copiez votre dump dans un emplacement accessible, par exemple `docker/postgres/dumps/mon-dump.sql`.
2. Demarrez au minimum PostgreSQL :

```powershell
docker compose up -d postgres
```

3. Importez le dump avec le script Windows fourni :

```powershell
.\scripts\import-db-dump.ps1 -DumpPath .\docker\postgres\dumps\mon-dump.sql
```

Une variante shell est aussi disponible :

```bash
./scripts/import-db-dump.sh ./docker/postgres/dumps/mon-dump.sql
```

Notes utiles :

- si le dump contient deja la table `_prisma_migrations`, `npm run prisma:migrate:deploy` reprendra proprement l'etat de Prisma au demarrage du backend
- si vous voulez repartir d'une base vide avant import, supprimez le volume `postgres_data` manuellement
- n'importez pas le dump pendant qu'une autre restauration est en cours

## Dokploy

Le deploiement sur Dokploy est realiste pour :

- `postgres`
- `redis`
- `backend`
- `backend-worker`
- `frontend`
- `admin-web`
- `admin-mobile`

Le `print-agent` n'est deployable sur Dokploy que si le serveur Dokploy peut joindre les imprimantes du reseau local en TCP (`9100`) et si cette topologie est volontaire. Dans la plupart des cas, le bon schema est :

- Dokploy heberge le coeur applicatif
- le `print-agent` tourne dans un conteneur Docker separe sur le Raspberry Pi ou sur une machine du meme LAN que les imprimantes
- `PRINT_AGENT_API_BASE_URL` pointe alors vers le domaine public de l'API

### Recommandation Dokploy

Utiliser `compose.yaml` comme stack principale.

Pour une base de configuration production, vous pouvez partir de
[.env.production.dokploy.example](c:\Users\Admin\Documents\Pizzeria%20docker\.env.production.dokploy.example).
Dans votre cas, ce fichier est deja pre-rempli avec :

- site public : `https://alban.flow-os.fr`
- API : `https://api.alban.flow-os.fr`
- admin web V2 : `https://admin-web.alban.flow-os.fr`
- admin mobile : `https://admin.alban.flow-os.fr`

Guide de deploiement complet :

- [DOKPLOY_DEPLOYMENT.md](c:\Users\Admin\Documents\Pizzeria%20docker\DOKPLOY_DEPLOYMENT.md)

Variables a definir dans Dokploy :

- toutes les variables du fichier `.env.example`
- en production HTTPS :
  - `TRUST_PROXY=true`
  - `ENABLE_HSTS=true`
  - `AUTH_COOKIE_SECURE=true`
  - `AUTH_COOKIE_SAMESITE=none` si le front/admin et l'API sont sur des sous-domaines differents

Volumes a conserver :

- `postgres_data`
- `redis_data`
- `backend_uploads`
- `print_agent_data` uniquement si vous deployez vraiment le print agent sur Dokploy

Ports internes a utiliser dans Dokploy Domains :

- `frontend` : `8000`
- `backend` : `5000`
- `admin-web` : `4174`
- `admin-mobile` : `80`

Important pour Dokploy :

- preferer les volumes nommes pour la persistance
- ne pas compter sur un montage runtime du depot Git pour conserver des donnees
- si vous devez injecter un dump SQL sur Dokploy, faites-le via un fichier monte dans Dokploy ou restaurez d'abord PostgreSQL avant le premier trafic
