# Dokploy Deployment Guide

Ce document couvre le deploiement production complet de la stack Pizzeria sur Dokploy, sans le `print-agent`.

## Perimetre deploye

Services inclus :

- `postgres`
- `redis`
- `backend`
- `backend-worker`
- `frontend`
- `admin-mobile`

Service exclu pour cette phase :

- `print-agent`

Hypotheses de domaines :

- site public : `https://alban.flow-os.fr`
- API : `https://api.alban.flow-os.fr`
- admin mobile : `https://admin.alban.flow-os.fr`

Fichier d'environnement de base :

- [.env.production.dokploy.example](c:\Users\Admin\Documents\Pizzeria%20docker\.env.production.dokploy.example)

Stack a deployer :

- [compose.yaml](c:\Users\Admin\Documents\Pizzeria%20docker\compose.yaml)

Ne pas utiliser en production :

- [compose.local.yaml](c:\Users\Admin\Documents\Pizzeria%20docker\compose.local.yaml)

## Etat actuel du projet

Valide localement :

- la stack Compose est valide
- les images buildent
- `postgres`, `redis`, `backend`, `backend-worker`, `frontend`, `admin-mobile` demarrent ensemble
- la base Docker a bien recu le dump `pizzeria_db_layr.dump`
- les checks de sante repondent

Conclusion :

- la base technique de deploiement est prete
- la mise en production depend maintenant de la qualite des variables, du DNS et du premier deploiement Dokploy

## Checklist Finale

### 1. DNS

A faire avant le deploy :

- creer un enregistrement `A` pour `alban.flow-os.fr` vers l'IP publique du serveur Dokploy
- creer un enregistrement `A` pour `api.alban.flow-os.fr` vers l'IP publique du serveur Dokploy
- creer un enregistrement `A` pour `admin.alban.flow-os.fr` vers l'IP publique du serveur Dokploy
- attendre la propagation DNS

Verification :

```bash
dig +short alban.flow-os.fr
dig +short api.alban.flow-os.fr
dig +short admin.alban.flow-os.fr
```

Les trois doivent pointer vers le serveur Dokploy.

### 2. Variables de production

A remplacer avant le deploy :

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `CONTACT_RECIPIENT_EMAIL`
- eventuellement `WEB_PUSH_VAPID_PUBLIC_KEY`
- eventuellement `WEB_PUSH_VAPID_PRIVATE_KEY`

Doivent rester ainsi :

- `TRUST_PROXY=true`
- `ENABLE_HSTS=true`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAMESITE=lax`
- `PUBLIC_FRONTEND_URL=https://alban.flow-os.fr`
- `PUBLIC_BACKEND_URL=https://api.alban.flow-os.fr`
- `PUBLIC_ADMIN_URL=https://admin.alban.flow-os.fr`
- `BACKEND_CORS_ORIGINS=https://alban.flow-os.fr,https://admin.alban.flow-os.fr`

### 3. Volumes et persistance

Volumes a conserver :

- `postgres_data`
- `redis_data`
- `backend_uploads`

Backups recommandes :

- backup volume Dokploy pour `postgres_data`
- backup volume Dokploy pour `backend_uploads`

`redis_data` peut aussi etre sauvegarde, mais il est moins critique que la base et les uploads.

### 4. Domaines Dokploy

Configurer ces domaines :

- `frontend` vers `alban.flow-os.fr` sur le port conteneur `8000`
- `backend` vers `api.alban.flow-os.fr` sur le port conteneur `5000`
- `admin-mobile` vers `admin.alban.flow-os.fr` sur le port conteneur `80`

Ne pas attacher de domaine a :

- `postgres`
- `redis`
- `backend-worker`

### 5. Base de donnees

Choisir une strategie avant ouverture au public :

- soit base vide + migrations Prisma au premier boot
- soit restauration du dump de production avant mise en ligne

Dans votre cas, si vous voulez repartir avec les donnees actuelles, restaurer le dump avant l'ouverture publique.

### 6. Smoke tests obligatoires

A faire juste apres deploy :

- ouvrir `https://alban.flow-os.fr`
- ouvrir `https://admin.alban.flow-os.fr`
- verifier `https://api.alban.flow-os.fr/healthz`
- verifier `https://api.alban.flow-os.fr/readyz`
- tester un login admin
- verifier que les produits se chargent
- verifier que les categories se chargent
- verifier qu'une commande peut etre lue
- verifier que les uploads/images publiques se chargent

## Procedure Dokploy

## 1. Creer le service Compose

Dans Dokploy :

1. Creer un nouveau projet si besoin.
2. Creer un nouveau service de type `Docker Compose`.
3. Connecter le repo Git contenant ce dossier racine.
4. Pointer la source sur le dossier racine du projet.
5. Utiliser [compose.yaml](c:\Users\Admin\Documents\Pizzeria%20docker\compose.yaml) comme fichier Compose.

Important :

- ne pas utiliser `Stack` si vous voulez conserver la logique `build` actuelle
- le mode `Docker Compose` est le bon choix pour cette stack

## 2. Injecter l'environnement

Dans Dokploy, coller les variables de [.env.production.dokploy.example](c:\Users\Admin\Documents\Pizzeria%20docker\.env.production.dokploy.example) dans les variables du service Compose, puis remplacer les placeholders.

Pourquoi ca fonctionne :

- Dokploy ecrit les variables du panneau dans un fichier `.env`
- notre `compose.yaml` reference explicitement les variables avec `${VAR}`

Recommendation :

- mettre les secrets reutilisables au niveau projet ou environnement
- ne mettre au niveau service que les overrides si necessaire

## 3. Configurer les domaines

Dans Dokploy, ajouter ces domaines :

### Domaine 1

- Host : `alban.flow-os.fr`
- Service : `frontend`
- Container Port : `8000`
- HTTPS : active
- Certificate : `letsencrypt`
- Path : vide
- Internal Path : vide
- Strip Path : desactive

### Domaine 2

- Host : `api.alban.flow-os.fr`
- Service : `backend`
- Container Port : `5000`
- HTTPS : active
- Certificate : `letsencrypt`
- Path : vide
- Internal Path : vide
- Strip Path : desactive

### Domaine 3

- Host : `admin.alban.flow-os.fr`
- Service : `admin-mobile`
- Container Port : `80`
- HTTPS : active
- Certificate : `letsencrypt`
- Path : vide
- Internal Path : vide
- Strip Path : desactive

Notes utiles :

- pour un service Docker Compose, un changement de domaine demande un redeploy
- le `Container Port` dans le domaine sert au routage Traefik, pas a exposer directement un port public

## 4. Premier deploiement recommande

Ordre recommande :

### Option A: base vide

1. Deploy complet de la stack.
2. Attendre les statuts `healthy`.
3. Faire les tests applicatifs.

### Option B: restauration du dump avant ouverture

1. Deploy complet de la stack.
2. Attendre que `postgres` soit pret.
3. Restaurer le dump dans PostgreSQL.
4. Redemarrer `backend` et `backend-worker`.
5. Faire les tests applicatifs.

Pour votre cas, l'option B est la plus logique.

## 5. Restauration du dump sur Dokploy

Le dump local actuel est :

- [pizzeria_db_layr.dump](c:\Users\Admin\Documents\Pizzeria%20docker\docker\postgres\dumps\pizzeria_db_layr.dump)

Comme c'est un dump PostgreSQL `CUSTOM`, il faut utiliser `pg_restore`.

Approche recommandee sur le serveur Dokploy :

1. Deployer la stack une premiere fois.
2. Identifier le conteneur PostgreSQL du service Compose.
3. Copier le dump dans ce conteneur.
4. Recreer la base cible.
5. Restaurer avec `pg_restore`.

Exemple generique depuis le serveur Dokploy en SSH :

```bash
docker ps --format '{{.Names}}' | grep postgres
docker cp ./pizzeria_db_layr.dump <postgres-container>:/tmp/pizzeria_db_layr.dump
docker exec -it <postgres-container> sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '\''$POSTGRES_DB'\'' AND pid <> pg_backend_pid();" -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" -c "CREATE DATABASE \"$POSTGRES_DB\";"'
docker exec -it <postgres-container> sh -lc 'pg_restore --verbose --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/pizzeria_db_layr.dump'
```

Ensuite :

```bash
docker restart <backend-container> <backend-worker-container>
```

Si vous preferez, vous pouvez aussi restaurer dans une PostgreSQL temporaire hors Dokploy puis migrer vers la cible finale, mais ce n'est pas necessaire ici.

## 6. Verifications post-deploiement

Checks HTTP :

- `https://api.alban.flow-os.fr/healthz` doit renvoyer `200`
- `https://api.alban.flow-os.fr/readyz` doit renvoyer `200`
- `https://alban.flow-os.fr` doit charger
- `https://admin.alban.flow-os.fr` doit charger

Checks metier :

- lister les produits
- lister les categories
- verifier la page menu
- verifier la page commande
- verifier un login admin
- verifier le flux temps reel admin si utilise
- verifier que les images d'uploads s'affichent

Checks de persistance :

- redemarrer la stack
- verifier que les donnees sont toujours la
- verifier qu'un upload deja present reste accessible

## 7. Sauvegardes et exploitation

Apres stabilisation :

1. Configurer les Volume Backups Dokploy.
2. Sauvegarder au minimum :
   - `postgres_data`
   - `backend_uploads`
3. Tester au moins une restauration sur environnement non critique.

## 8. Checklist Go / No-Go

Passer en `GO` uniquement si tout est vrai :

- les 3 DNS pointent vers le serveur Dokploy
- les certificats HTTPS sont emis
- les secrets ont ete remplaces
- `backend` repond `healthz` et `readyz`
- `frontend` et `admin-mobile` chargent correctement
- les donnees sont presentes si vous restaurez le dump
- le login admin fonctionne
- les images/upload publics fonctionnent
- un redeploy de test ne casse pas l'application
- les backups de volumes sont configures ou planifies

Rester en `NO-GO` si l'un de ces points est faux :

- certificats HTTPS absents
- CORS/cookies cassent la connexion
- base vide alors qu'elle ne devrait pas l'etre
- uploads absents
- `readyz` echoue
- redeploy Dokploy detruit la persistance

## Notes Dokploy utiles

Selon la doc officielle Dokploy :

- les variables de l'UI sont ecrites dans un `.env`, et les services Compose doivent les consommer via `${VAR}` ou `env_file`
- pour Docker Compose, les changements de domaine demandent un redeploiement
- les volumes nommes sont recommandes si vous voulez de la persistance et des Volume Backups

Sources officielles :

- Docker Compose : https://docs.dokploy.com/docs/core/docker-compose
- Domains : https://docs.dokploy.com/docs/core/domains
- Environment Variables : https://docs.dokploy.com/docs/core/variables
- Volume Backups : https://docs.dokploy.com/docs/core/volume-backups
