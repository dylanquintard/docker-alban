# Livrable Mono-Camion

Objectif: livrer une version fiable pour un seul camion pizza avant de reprendre le SaaS multi-clients.

## Perimetre Produit

Inclus dans le livrable:

- site public de commande click and collect
- compte client, panier, personnalisation, choix du retrait
- admin tablette pour le camion
- suivi temps reel des commandes
- impression automatique des tickets POS
- reimpression et supervision simple des tickets
- deploiement serveur avec sauvegardes
- procedure de secours pour le service

Reporte apres le livrable:

- multi-tenant owner / entreprises
- abonnements clients SaaS
- facturation
- provisioning automatique de sites
- permissions avancees par entreprise
- stock avance

## Architecture Cible

```text
Client mobile
  -> site public
  -> panier
  -> creneau de retrait
  -> commande

Serveur
  -> frontend public
  -> backend API
  -> backend-worker
  -> Postgres
  -> Redis

Camion
  -> routeur 4G/5G
  -> CutiePi / tablette admin
  -> print-agent local
  -> imprimante POS
```

## Applications A Garder

- `pizzeria-backend`: coeur metier, API, Prisma, impression, realtime.
- `pizzeria-web-service-front`: site public et tunnel de commande.
- `pizzeria-admin-mobile-v2`: cible tablette.
- `pizzeria-admin-mobile`: fallback stable pendant la recette.
- `pizzeria-print-agent`: agent local camion.

## Etat Actuel

Statut au 2026-08-31:

- stack Docker locale demarree et healthy
- frontend public accessible sur `http://localhost:8000`
- backend accessible sur `http://localhost:5000`
- admin tablette v2 accessible sur `http://localhost:14174`
- admin fallback accessible sur `http://localhost:4173`
- administration reintegree dans le frontend via `/admin/orders`
- bouton `Admin` visible dans le header pour les comptes `ADMIN`
- entreprise locale configuree: `Il Forno d'Oro`
- reseaux sociaux configures:
  - Instagram: `https://www.instagram.com/ilfornodoro_/`
  - Facebook: `https://www.facebook.com/ilfornodoro`
- seed mono-camion reproductible
- seed demo mono-camion: vendredi/samedi 18:00-22:00
- horaires importes actuellement disponibles: dimanche/lundi 18:00-22:00, a confirmer avec le gerant
- smoke commande API valide: client -> panier -> creneau -> commande -> admin
- print-agent valide en dry-run et avec simulateur TCP POS local
- email Infomaniak valide en smoke SMTP local
- base de production Il Forno d'Oro importee en local depuis le VPS rescue
- uploads de production importes en local
- identite site locale corrigee: Il Forno d'Oro, contact@ilfornodoro.fr, Instagram, Facebook
- backend aligne sur le tenant par defaut `DEFAULT_TENANT_ID=1`
- parcours commande filtre par tenant: catalogue, categories, lieux, creneaux, settings, commandes, users/auth, print

Niveau d'avancement estime:

```text
Technique backend/stack: 70%
Parcours commande: 60-70%
Admin tablette: 50-60%
Presentation client final: 40-50%
Production reelle: 30-40%
```

Le projet est fonctionnel en socle technique, mais pas encore pret a etre presente comme produit fini sans recette manuelle et finitions UX.

## Import Production Il Forno d'Oro

Import realise le 2026-08-31 depuis le VPS rescue `176.57.150.158`.

Source identifiee:

- volume PostgreSQL: `platform-web-backoffice-5lm8cv_postgres_data`
- volume uploads: `platform-web-backoffice-5lm8cv_backend_uploads`
- base prod: `ap_platform`
- user prod: `axispilot`
- version PostgreSQL: 16

Archives locales sensibles conservees dans `docker/postgres/dumps/`:

- `prod-postgres-raw-20260831-150429.tgz`
- `prod-uploads-20260831-150429.tgz`
- `ilfornodoro-prod-20260831-150429.dump`
- sauvegarde locale avant import: `local-before-prod-import-20260831-150857.dump`
- sauvegarde uploads locale avant import: `local-uploads-before-prod-import-20260831-150857.tgz`

Donnees validees apres import:

- `User`: 9 avant comptes de smoke locaux
- `Pizza`: 18
- `Category`: 13
- `Location`: 1
- `Menu`: 2
- `TimeSlot`: 69
- `SiteSetting`: 1
- uploads: 24 fichiers

Correctifs locaux post-import:

- `siteName`: `Il Forno d'Oro`
- email contact site: `contact@ilfornodoro.fr`
- Instagram: `https://www.instagram.com/ilfornodoro_/`
- Facebook: `https://www.facebook.com/ilfornodoro`
- canonical SEO: `https://ilfornodoro.fr`

Note technique:

- la base production est plus recente/multi-tenant que le schema local actuel
- le diff Prisma propose des suppressions destructrices, il ne faut pas l'appliquer tel quel
- un doublon email existe en prod sur `quintarddylan@gmail.com`, donc il faut conserver l'unicite scopee tenant
- les index uniques globaux temporaires ajoutes localement pour debug ont ete retires
- `pizzeria-backend/prisma/schema.prisma` est maintenant aligne sur la base prod multi-tenant

Smoke post-import:

```powershell
cd pizzeria-backend
$env:SMOKE_PICKUP_DATE='2026-08-31'
npm run smoke:mono
Remove-Item Env:\SMOKE_PICKUP_DATE
```

Resultat:

- commande creee initiale: `orderId=44`
- commande creee apres realignement Prisma/Docker: `orderId=46`
- commande creee apres filtrage tenant: `orderId=48`
- date: `2026-08-31`
- date smoke tenant automatique: `2026-09-06`
- heure: `18:00`
- produit: `Margherita`
- statut commande: `COMPLETED`
- visible admin: `IN_PROGRESS`
- ticket cree: `70f27a69-9a79-4383-8069-4809875a5025`
- ticket cree apres filtrage tenant: `2d190bab-f94d-431e-af7c-a8c188f07115`
- statut ticket: `PENDING`
- imprimante: `printer_01`
- verification tenant: commande, ticket et imprimante en `tenantId=1`

## Definition Of Done

Le livrable est pret seulement si:

- une commande client arrive dans l'admin sans refresh manuel
- le ticket POS s'imprime automatiquement
- une commande peut etre validee ou annulee depuis la tablette
- une erreur d'impression est visible dans l'admin
- la reimpression fonctionne
- le site est utilisable sur mobile
- les donnees survivent a un redemarrage serveur
- les backups Postgres et uploads sont planifies
- le gerant connait la procedure de secours

## Phase 1 - Socle Reproductible

- [x] cloner le projet localement
- [x] installer les dependances
- [x] corriger les tests backend sans `.env` manuel obligatoire
- [x] corriger les vulnerabilites production connues
- [x] lancer Docker Desktop
- [x] valider `docker compose -f compose.yaml -f compose.local.yaml up -d --build`
- [x] verifier `http://localhost:5000/healthz`
- [x] verifier `http://localhost:5000/readyz`
- [x] verifier `http://localhost:8000`
- [x] verifier `http://localhost:14174`
- [x] executer `npm run seed:mono` dans `pizzeria-backend`
- [x] recetter commande -> admin tablette -> ticket imprime en dry-run

## Phase 2 - Seed Mono-Camion

Le seed doit fournir:

- un compte admin
- un compte client de test
- un lieu de retrait actif
- des horaires vendredi/samedi soir
- des categories de produits
- des ingredients de base et extras
- quelques pizzas de test
- un print-agent
- une imprimante POS
- des reglages site generiques

Commandes:

```powershell
cd pizzeria-backend
npm run prisma:migrate:deploy
npm run seed:mono
```

Identifiants locaux par defaut:

```text
Admin: admin@mono-camion.local / ChangeMe123!
Client: client@mono-camion.local / ChangeMe123!
Print agent code: agent-camion
Print agent token: local-print-agent-token-at-least-32-chars
Printer code: pos-camion
```

Ces valeurs sont pour le developpement et la recette locale. Elles doivent etre remplacees en production.

## Phase 3 - Parcours Client

- [x] tunnel commande API valide par `npm run smoke:mono`
- [ ] page commande mobile lisible en 375px
- [ ] menu ordonne par categories
- [ ] personnalisation pizza claire
- [ ] panier simple a comprendre
- [ ] choix date/horaire/adresse sans ambiguite
- [ ] confirmation avant finalisation
- [ ] message clair si aucun creneau n'est disponible
- [ ] email de confirmation verifie
- [ ] test de capacite creneau concurrente

### Recette Manuelle Parcours Commande

Objectif: verifier que le parcours est utilisable par un vrai client, pas seulement par API.

Preparation:

```text
Site public: http://localhost:8000
Admin integre: http://localhost:8000/admin/orders
Admin tablette v2: http://localhost:14174
Client test: client@mono-camion.local / ChangeMe123!
Admin test: admin@mono-camion.local / ChangeMe123!
```

Checklist client:

- [ ] ouvrir le site public
- [ ] verifier que le nom `Il Forno d'Oro` apparait correctement
- [ ] se connecter avec un compte client
- [ ] acceder a `Commander`
- [ ] voir les pizzas et boissons
- [ ] ouvrir le detail d'une pizza
- [ ] ajouter une pizza au panier
- [ ] modifier quantite ou personnalisation si disponible
- [ ] verifier le total panier
- [ ] choisir un jour de retrait disponible
- [ ] choisir un horaire disponible
- [ ] verifier l'adresse de retrait
- [ ] ajouter une note client
- [ ] finaliser la commande
- [ ] voir une confirmation claire
- [ ] retrouver la commande dans l'espace client

Checklist admin:

- [ ] se connecter avec un compte admin sur le frontend
- [ ] verifier que le bouton `Admin` apparait a cote de `Commander`
- [ ] ouvrir `/admin/orders`
- [ ] verifier que la commande client apparait sans refresh manuel
- [ ] ouvrir le detail commande
- [ ] verifier nom, telephone, articles, horaire, note et total
- [ ] valider la commande
- [ ] annuler une commande de test
- [ ] verifier que les statuts sont comprehensibles

Critere de validation:

- une personne non technique doit pouvoir passer une commande sans explication orale
- le gerant doit pouvoir comprendre et traiter la commande depuis la tablette
- aucun creneau affiche comme disponible ne doit echouer a la finalisation

## Phase 4 - Tablette Camion

- [x] administration accessible depuis le frontend pour un compte admin
- [ ] faire de `pizzeria-admin-mobile-v2` l'interface principale tablette
- [ ] conserver `pizzeria-admin-mobile` en fallback
- [ ] ecran commandes optimisable pour les doigts
- [ ] detail commande avec telephone, note, horaire, articles, total
- [ ] boutons validation/annulation visibles
- [ ] supervision tickets visible depuis le launcher
- [ ] etat agent/imprimante visible rapidement
- [ ] action reimprimer accessible en service
- [ ] tests minimum sur API helpers et formatters v2

## Phase 5 - Impression Terrain

- [ ] creer agent et imprimante via seed ou admin
- [x] demarrer le print-agent local en dry-run
- [x] verifier `GET /health` du print-agent
- [ ] lancer un test print local
- [x] commander via smoke API client
- [x] verifier creation du `PrintJob`
- [x] verifier impression dry-run via reimpression immediate
- [ ] verifier reimpression depuis la tablette
- [ ] simuler imprimante eteinte
- [ ] simuler coupure internet

Commande de recette locale:

```powershell
docker compose -f compose.yaml -f compose.local.yaml --profile print-agent up -d --build
docker compose -f compose.yaml -f compose.local.yaml exec -T backend npm run prisma:migrate:deploy
docker compose -f compose.yaml -f compose.local.yaml exec -T backend npm run seed:mono
cd pizzeria-backend
npm run smoke:mono
```

## Phase 6 - Production

- [ ] choisir les domaines finaux
- [ ] configurer DNS
- [ ] configurer variables Dokploy
- [ ] activer HTTPS
- [ ] configurer `TRUST_PROXY=true`
- [ ] configurer `ENABLE_HSTS=true`
- [ ] configurer `AUTH_COOKIE_SECURE=true`
- [ ] valider CORS/cookies
- [ ] configurer sauvegardes Postgres
- [ ] configurer sauvegardes uploads
- [ ] tester restauration hors production

## Plan Pret Prod - Modele Multi-Tenant

Decision du 2026-08-31:

- le modele de production multi-tenant est conserve
- le code local doit etre realigne sur la base de production
- la base de production ne doit pas etre simplifiee vers le modele mono-camion actuel
- Il Forno d'Oro sera livre comme tenant principal du livrable camion

Objectif:

- utiliser le meme schema logique en local et en production
- eviter les migrations destructrices
- livrer le mono-camion Il Forno d'Oro sans bloquer la future plateforme multi-clients

### 1. Audit Schema Prod Vers Code Local

- [x] importer une copie prod en local
- [x] identifier la derive Prisma actuelle
- [ ] documenter les champs/tables prod absents du schema local
- [ ] classer les differences: livrable camion, plateforme owner, obsolete/a confirmer

Differences deja observees:

- table `Tenant`
- champs `tenantId` sur les entites principales
- table `Menu`
- tables stock: `StockItem`, `StockZone`, `StockPosition`, `StockCount`, etc.
- tables d'assignation: `UserPositionAssignment`, `PositionZoneAssignment`, `ZoneItemAssignment`, etc.
- index uniques scoppes par tenant, dont `User_tenantId_email_key`
- doublon email existant sur `quintarddylan@gmail.com`

Regle:

- ne pas appliquer le diff Prisma destructeur actuel
- ne pas supprimer `tenantId`, `Tenant`, `Menu` ou les tables stock sans decision explicite

### 2. Realignement Prisma Multi-Tenant

- [x] mettre a jour `pizzeria-backend/prisma/schema.prisma` avec le modele prod
- [x] reintegrer `Tenant`
- [x] reintegrer `tenantId` sur les tables concernees
- [x] reintegrer `Menu` et les relations categories/menus
- [x] reintegrer les tables stock presentes en prod
- [x] reintegrer les tables d'assignation presentes en prod
- [x] aligner les enums avec la prod
- [x] aligner les index uniques scoppes tenant
- [x] generer le client Prisma
- [x] verifier que `prisma migrate diff` ne propose plus de suppression massive
- [x] reconstruire `backend` et `backend-worker` avec le client Prisma realigne

Strategie recommandee:

- produire d'abord un schema Prisma representatif de la prod
- creer ensuite des migrations propres et non destructrices
- utiliser un tenant courant unique par defaut pour Il Forno d'Oro

### 3. Strategie Tenant Unique Pour Le Camion

- [x] identifier le tenant courant dans la base: `id=1`, slug historique `alban`
- [x] definir une variable serveur type `DEFAULT_TENANT_ID`
- [x] filtrer les lectures publiques par tenant
- [x] filtrer commandes, produits, categories, horaires, lieux et site settings
- [x] filtrer l'admin camion par tenant
- [ ] conserver une voie owner plateforme pour gerer plusieurs tenants plus tard
- [x] verifier que les tickets imprimante portent le bon tenant
- [ ] renommer/normaliser le tenant prod en `ilfornodoro` et domaine `ilfornodoro.fr`

Regle fonctionnelle:

- le site public ne doit voir que les donnees Il Forno d'Oro
- l'admin camion ne doit gerer que son entreprise
- l'owner plateforme pourra gerer plusieurs entreprises plus tard

### 4. Correction Des Donnees Prod

- [ ] resoudre le doublon email `quintarddylan@gmail.com`
- [ ] verifier les users admin/client reels
- [ ] verifier les roles
- [ ] verifier `emailVerified` et `phoneVerified`
- [ ] verifier les horaires reels du camion
- [ ] verifier les prix produits
- [ ] verifier les categories visibles
- [ ] verifier les images et logos
- [ ] verifier les reseaux sociaux
- [ ] verifier les infos contact

Donnees Il Forno d'Oro attendues:

- nom: `Il Forno d'Oro`
- email contact: `contact@ilfornodoro.fr`
- email envoi: `no-reply@ilfornodoro.fr`
- Instagram: `https://www.instagram.com/ilfornodoro_/`
- Facebook: `https://www.facebook.com/ilfornodoro`
- domaine: `https://ilfornodoro.fr`

### 5. Backend Pret Prod

- [x] adapter les services backend au tenant courant
- [x] verifier `products`
- [x] verifier `categories`
- [x] verifier `locations`
- [x] verifier `timeslots`
- [x] verifier `orders`
- [x] verifier `site-settings`
- [ ] verifier `gallery`
- [x] verifier `print`
- [x] verifier `users/auth`
- [ ] verifier les droits admin
- [ ] ajouter tests tenant sur endpoints critiques
- [ ] verifier absence de fuite inter-tenant par tests automatises

Endpoints critiques:

- `GET /api/site-settings/public`
- `GET /api/products`
- `GET /api/categories`
- `GET /api/locations`
- `GET /api/timeslots/public-weekly-settings`
- `GET /api/timeslots/availability`
- `POST /api/orders/cart`
- `POST /api/orders/finalize`
- `GET /api/orders` cote admin
- `GET /api/print/admin/jobs`

### 6. Frontend Pret Prod

- [ ] verifier que le site public affiche uniquement Il Forno d'Oro
- [ ] verifier logo/favicon prod
- [ ] verifier menu reel
- [ ] verifier panier mobile
- [ ] verifier choix date/creneau
- [ ] verifier confirmation commande
- [ ] verifier pages contact/blog/galerie si conservees
- [ ] verifier lien admin visible pour admin seulement
- [ ] verifier l'admin integre au frontend
- [ ] verifier responsive 375px, tablette, desktop

URLs locales:

- site public: `http://localhost:8000`
- admin integre: `http://localhost:8000/admin/orders`
- backend: `http://localhost:5000`

### 7. Impression Camion

- [ ] confirmer imprimante POS finale
- [ ] configurer IP fixe imprimante ou reservation DHCP
- [ ] configurer routeur camion
- [ ] configurer CutiePi
- [ ] installer/lancer print-agent au demarrage
- [ ] tester impression ticket 80mm
- [ ] tester reimpression depuis admin tablette
- [ ] tester imprimante eteinte
- [ ] tester coupure reseau local
- [ ] tester reprise apres reconnexion

Etat actuel:

- print-agent valide en dry-run
- simulateur TCP POS disponible
- impression physique a valider plus tard

### 8. Mail Production

- [x] SMTP Infomaniak valide en local
- [ ] configurer variables SMTP dans Dokploy
- [ ] verifier `SMTP_FROM`
- [ ] verifier `CONTACT_RECIPIENT_EMAIL`
- [ ] tester mail contact
- [ ] tester verification email
- [ ] tester reset password
- [ ] verifier SPF/DKIM/DMARC Infomaniak

Variables attendues:

- `SMTP_HOST=mail.infomaniak.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=no-reply@ilfornodoro.fr`
- `SMTP_FROM="Il Forno d'Oro <no-reply@ilfornodoro.fr>"`
- `CONTACT_RECIPIENT_EMAIL=contact@ilfornodoro.fr`

### 9. Preproduction

- [ ] remettre le VPS hors rescue ou preparer un VPS/staging
- [ ] deployer la stack Dokploy
- [ ] restaurer une copie de la base prod
- [ ] restaurer les uploads
- [ ] appliquer migrations non destructrices
- [ ] configurer domaines de preprod si besoin
- [ ] verifier HTTPS
- [ ] lancer smoke backend
- [ ] lancer smoke commande
- [ ] lancer smoke mail
- [ ] tester admin tablette

Critere de sortie:

- le parcours client complet fonctionne sur une URL distante
- l'admin recoit la commande
- le ticket est genere
- aucun endpoint public ne fuit de donnees hors tenant

### 10. Mise En Production

- [ ] generer une sauvegarde prod juste avant bascule
- [ ] sauvegarder base PostgreSQL
- [ ] sauvegarder uploads
- [ ] sauvegarder variables Dokploy
- [ ] deployer le code realigne
- [ ] appliquer migrations
- [ ] redemarrer backend/backend-worker/frontend
- [ ] verifier healthchecks
- [ ] verifier DNS/HTTPS
- [ ] faire une commande reelle de test
- [ ] verifier admin tablette
- [ ] verifier ticket imprime ou ticket pending si imprimante non branchee
- [ ] verifier mail
- [ ] documenter le rollback

Critere GO:

- `https://ilfornodoro.fr` charge
- catalogue reel visible
- horaires reels visibles
- commande test finalisee
- commande visible admin
- ticket cree
- compte admin accessible depuis le frontend
- SMTP valide
- backup valide
- aucune migration destructive appliquee

Critere NO-GO:

- schema Prisma non aligne
- commandes impossibles
- creneaux absents
- admin inaccessible
- fuite inter-tenant
- images/uploads absents
- mail critique non fonctionnel si verification obligatoire
- backup absent

### 11. Securite Apres Intervention

- [ ] regenerer la cle SSH collee dans le chat
- [ ] retirer l'ancienne cle de `authorized_keys`
- [ ] changer le mot de passe rescue/root si applicable
- [ ] verifier les acces Dokploy
- [ ] verifier que les dumps locaux ne sont pas commites
- [ ] conserver les dumps uniquement dans un dossier ignore git
- [ ] stocker les secrets dans un coffre, pas dans le repo

## Runbook Service

Avant ouverture:

1. Allumer routeur, tablette, imprimante.
2. Verifier que la tablette charge l'admin.
3. Verifier que le flux direct est connecte.
4. Verifier que l'imprimante est en ligne.
5. Lancer un test print.
6. Ouvrir les creneaux du jour.

Pendant le service:

1. Traiter les commandes dans l'ordre des horaires.
2. Utiliser la validation quand la commande est remise.
3. Annuler uniquement si la commande ne sera pas servie.
4. Reimprimer depuis l'ecran tickets si besoin.

En cas de panne:

1. Si l'imprimante ne repond pas, redemarrer imprimante puis print-agent.
2. Si internet tombe, prendre les commandes au telephone ou sur papier.
3. Si la tablette ne charge pas, utiliser l'admin fallback.
4. Si le serveur est indisponible, basculer sur procedure papier.

## Priorites De Reprise

1. Valider Docker de bout en bout.
2. Executer et ajuster le seed mono-camion.
3. Recetter le tunnel client complet.
4. Recetter la tablette v2 en conditions camion.
5. Brancher une vraie imprimante POS.
6. Deployer une instance de preproduction.
