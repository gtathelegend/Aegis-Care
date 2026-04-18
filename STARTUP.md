# Aegis Care — Startup Runbook

## 0. Prerequisites (one-time)

```bash
# AlgoKit CLI + pipx
pipx install algokit
pipx ensurepath    # restart terminal after this

# Python 3.12 (project requires ^3.12)
scoop bucket add versions
scoop install python312

# Poetry
pipx install poetry

# Docker Desktop must be running (needed for LocalNet)
```

## 1. Point Poetry at Python 3.12

```bash
cd d:/Vedaang/PPO/Aegis-Care/projects/aegis-contracts
poetry env use "C:/Users/vedaa/scoop/apps/python312/current/python.exe"
```

## 2. Bootstrap dependencies (Python + npm, both projects)

```bash
cd d:/Vedaang/PPO/Aegis-Care
algokit project bootstrap all
```

## 3. Start LocalNet

```bash
algokit localnet start
# verify
algokit localnet status
```

## 4. Build contracts

```bash
cd d:/Vedaang/PPO/Aegis-Care/projects/aegis-contracts
algokit project run build
```

## 5. Deploy contracts to LocalNet

```bash
algokit project deploy localnet
```

Record the app IDs from the output. If any change, update [projects/aegis-frontend/.env](projects/aegis-frontend/.env) and [projects/aegis-contracts/.env](projects/aegis-contracts/.env) accordingly.

## 6. (Optional) Re-deploy to wire bootstrap links

`VITE_AUDIT_LOG_APP_ID` and `VITE_QUEUE_MANAGER_APP_ID` are set in [projects/aegis-contracts/.env](projects/aegis-contracts/.env), so re-running the deploy will link MedicalRecords→AuditLog and DataAccessManager→QueueManager:

```bash
algokit project deploy localnet
```

## 7. Run the frontend

```bash
cd d:/Vedaang/PPO/Aegis-Care/projects/aegis-frontend
npm run dev
```

Open http://localhost:5173/.

---

## Daily workflow (after first-time setup)

```bash
algokit localnet start                                    # start Docker containers
cd d:/Vedaang/PPO/Aegis-Care/projects/aegis-frontend
npm run dev                                               # regenerates clients + serves UI
```

Only re-run steps 4–6 when you edit `smart_contracts/*/contract.py`.

## Troubleshooting

- **`poetry: command not found`** → `pipx ensurepath` and restart terminal.
- **`The currently activated Python version 3.11.x is not supported`** → redo step 1.
- **`Cannot connect to Docker`** → start Docker Desktop, then `algokit localnet start`.
- **Frontend shows "APP_ID = 0" errors** → app IDs in [projects/aegis-frontend/.env](projects/aegis-frontend/.env) don't match the deployed ones; update and restart `npm run dev`.
- **LocalNet state got weird** → `algokit localnet reset` then redo steps 3, 5.
