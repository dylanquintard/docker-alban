# pizzeria-print-agent

Bridge local Raspberry Pi pour l'impression thermique:
- heartbeat vers `pizzeria-backend`
- polling jobs `/api/print/agents/:agentCode/claim-next`
- impression ESC/POS TCP (port 9100)
- spool SQLite local (`pending_acks`, `local_jobs`)
- API locale:
  - `GET /health`
  - `POST /test-print`
  - `POST /reprint-last`

## Installation

```bash
npm install
cp .env.example .env
# editer .env
npm start
```

## Variables critiques

- `API_BASE_URL`
- `AGENT_CODE`
- `AGENT_NAME`
- `AGENT_TOKEN`
- Mono imprimante:
  - `PRINTER_CODE`
  - `PRINTER_IP`
  - `PRINTER_PORT`
- Multi imprimantes (optionnel):
  - `PRINTERS_JSON` (JSON array `[{code,ip,port}]`)
- `SQLITE_PATH`
- `LOCAL_HTTP_HOST` (optionnel, defaut `127.0.0.1`)
- `LOCAL_HTTP_PORT` (optionnel, defaut `3000`)
- `LOCAL_ADMIN_TOKEN` (obligatoire en production)

## Endpoints locaux

Sans token local (dev/test uniquement):
```bash
curl http://127.0.0.1:3000/health
```

Avec `LOCAL_ADMIN_TOKEN`:
```bash
curl -X POST http://127.0.0.1:3000/test-print \
  -H "x-local-token: TON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Bonjour test","printerCode":"kitchen_main"}'

curl -X POST http://127.0.0.1:3000/reprint-last \
  -H "x-local-token: TON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"printerCode":"kitchen_main"}'
```

En production (`NODE_ENV=production`), `LOCAL_ADMIN_TOKEN` doit etre defini au demarrage sinon le process refuse de se lancer.

## Simulateur POS local

Pour tester sans imprimante physique, lancer un faux serveur TCP ESC/POS:

```bash
npm run sim:pos
```

Par defaut, il ecoute sur `0.0.0.0:9100` et ecrit les tickets dans `tmp/pos-simulator`:

- `.bin`: flux ESC/POS brut envoye a l'imprimante
- `.txt`: extrait texte lisible pour recette

Exemple de configuration print-agent:

```env
DRY_RUN=false
PRINTER_IP=127.0.0.1
PRINTER_PORT=9100
```

Variables utiles:

- `POS_SIM_HOST`
- `POS_SIM_PORT`
- `POS_SIM_OUTPUT_DIR`

## Service systemd (Pi)

```bash
sudo cp systemd/pizzeria-print-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pizzeria-print-agent
sudo systemctl start pizzeria-print-agent
sudo systemctl status pizzeria-print-agent --no-pager
```
