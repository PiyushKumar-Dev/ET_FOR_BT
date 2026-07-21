# 🛡️ Industrial Guardian AI
## ET AI Hackathon 2026 — Problem Statement 1

**AI-powered Industrial Safety Intelligence Platform with Compound Risk Detection**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INDUSTRIAL GUARDIAN AI                            │
├──────────┬────────────┬────────────┬────────────┬──────────────────┤
│  SCADA   │    IoT     │   Vision   │   Permit   │   Master AI      │
│  Agent   │   Agent    │   Agent    │   Agent    │   (Compound)     │
│ :8001    │  :8002     │   :8003    │   :8004    │   :8005          │
│ Isolation│ Rule+ML    │ YOLOv8n    │ LangChain  │ FAISS+LLM Fusion │
│ Forest   │ Compound   │ PPE Detect │ Conflict   │ RAG 500 Incidents│
│ + SHAP   │ Flagging   │ Simulation │ Detection  │ 8 Scenarios      │
└──────────┴────────────┴────────────┴────────────┴──────────────────┘
                              ↓ Socket.IO / REST
              ┌───────────────────────────────────┐
              │    Backend Orchestrator (Node.js)  │
              │  Express + Socket.IO + MongoDB     │
              │           :3000                    │
              └───────────────────────────────────┘
                              ↓ WebSocket
              ┌───────────────────────────────────┐
              │     React Dashboard (Vite)         │
              │  4 Pages + Live Risk Monitoring    │
              │           :5173                    │
              └───────────────────────────────────┘
```

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
cp .env.example .env
# Add API keys to .env (optional)
docker-compose up --build
```
Open: http://localhost:5173

### Option 2: Local Development

**Terminal 1 — SCADA Agent**
```bash
cd agents/scada-agent
pip install -r requirements.txt
python main.py
```

**Terminal 2 — IoT Agent**
```bash
cd agents/iot-agent
pip install -r requirements.txt
python main.py
```

**Terminal 3 — Vision Agent**
```bash
cd agents/vision-agent
pip install -r requirements.txt
python main.py
```

**Terminal 4 — Permit Agent**
```bash
cd agents/permit-agent
pip install -r requirements.txt
python main.py
```

**Terminal 5 — Master Agent**
```bash
cd agents/master-agent
pip install -r requirements.txt
python main.py
```

**Terminal 6 — Backend**
```bash
cd backend
npm install
npm run dev
```

**Terminal 7 — Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## 🎯 Demo Day Script (3 Minutes)

| Time | Action |
|------|--------|
| 0:00 | Dashboard shows normal facility — risk score ~22 |
| 0:20 | Navigate to Facility Map — show zones |
| 0:40 | Click **Demo Scenarios → Trigger CR-001** |
| 1:00 | Return to Dashboard — watch risk climb: 22 → 48 → 74 → **95** |
| 1:15 | CRITICAL alert fires — "Explosion Precursor" |
| 1:25 | Click alert → show individual scores (42, 38, 25) vs compound (**95**) |
| 1:40 | Navigate to **Agent Intelligence** — compound flow diagram |
| 2:00 | Show RAG output: similar historical incident + regulatory reference |
| 2:15 | Show recommendations with time-to-act priorities |
| 2:30 | Acknowledge alert — show incident in timeline |
| 2:45 | Click **Reset All** — facility returns to baseline |
| 3:00 | ✅ DONE |

---

## 🧠 Compound Risk Detection — The Core Innovation

| Agent | Individual Risk Score | Alert Level |
|-------|-----------------------|-------------|
| SCADA (pressure anomaly) | 42/100 | ⚠️ MEDIUM |
| IoT (gas accumulation) | 38/100 | ⚠️ MEDIUM |
| Permit (hot work active) | 25/100 | ✅ LOW |
| **Master AI (compound)** | **95/100** | **🔴 CRITICAL** |

**No single agent would have triggered a CRITICAL alert. The Master AI fuses all signals.**

---

## 📁 Project Structure

```
industrial-guardian-ai/
├── data-generators/          # Synthetic data engines
│   ├── facility_config.py    # 6 zones, 106 assets
│   ├── scada_generator.py    # Asset telemetry
│   ├── iot_generator.py      # Zone sensors
│   ├── permit_generator.py   # Work permits
│   ├── personnel_generator.py # Personnel tracking
│   └── incident_generator.py  # 500+ historical incidents
├── agents/
│   ├── scada-agent/          # IsolationForest + SHAP
│   ├── iot-agent/            # Rule engine + compound flagging
│   ├── vision-agent/         # YOLOv8n + synthetic CCTV
│   ├── permit-agent/         # LangChain + conflict rules
│   └── master-agent/         # FAISS RAG + LLM fusion
├── backend/                  # Express + Socket.IO + Mongoose
├── frontend/                 # React + Recharts + Leaflet
└── docker-compose.yml        # Full stack orchestration
```

---

## 🛡️ Regulatory References
- **OISD-GS-1 Clause 4.2.3** — Hot work near flammable atmosphere
- **OISD-STD-105** — Permit to work system
- **Factory Act 1948 Section 36A** — Explosive zones
- **NFPA 70E** — Arc flash protection
- **API 510** — Pressure vessel inspection

---

## 🏆 Hackathon Scoring Alignment

| Criterion | Our Feature | Score |
|-----------|-------------|-------|
| Innovation (25%) | 8 compound scenarios, FAISS RAG, LLM fusion | ✅ |
| Business Impact (25%) | Real regulatory refs, 3-min demo script | ✅ |
| Technical Excellence (25%) | IsolationForest + SHAP + YOLOv8 + FAISS | ✅ |
| Presentation (25%) | Live dashboard, compound flow diagram | ✅ |
