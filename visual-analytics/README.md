# 🔍 Visual Analytics — Mule Hunter

Live Demo: **https://mule-hunter-viz-latest.onrender.com/**

Visual Analytics is the forensic visualization and explainability module of the Mule Hunter platform.  
It transforms anomaly detection results into an interactive, explainable 3D graph experience for fast, meaningful insights.

---

## 🚀 Overview

This module is responsible for:

- **Zero-Day Anomaly Detection** using Extended Isolation Forest (EIF)
- **3D Fraud Network Visualization** (WebGL)
- **Explainable AI (XAI)** using SHAP explanations
- **Interactive Node Inspector** for forensic analysis

It visualizes financial transaction graphs with risk scores, highlights suspicious nodes, and provides human-readable explanations.

---

## 🧠 Architecture

- nodes.csv + transactions.csv   

- Extended Isolation Forest (EIF)   
  
- nodes_scored.csv    
  
- Graph Adapter (viz_ready_nodes.py)    
  
- nodes_viz.json + fraud_explanations.json     
  
- React WebGL Visualization        
  
- Interactive Investigative UI      

---

## 🧪 Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- Docker (optional but recommended)

### Install Python Dependencies

```bash
pip install -r requirements.txt

```

### Run Anomaly Detection

```
python anomaly-detection/eif_detector.py
python anomaly-detection/score_nodes.py
```

### Prepare Graph Data

```
python viz_ready_nodes.py
```

### Run Visualization UI

```
cd visualization
npm install
npm run dev
```

Open your browser at http://localhost:5173

## 🐳 Dockerization

The visualization UI is Dockerized for production delivery.

### Build the Docker Image

```
docker build -t mule-hunter-viz .
```

### Run the Docker Container

```
docker run -p 3000:80 mule-hunter-viz
```

**Visit: http://localhost:3000**

## ☁️ Deployment

### Current live deployment:

**👉 https://mule-hunter-viz-latest.onrender.com/**

```
Note: Free tiers may “sleep” after inactivity.
Warm up the URL before demos.
```

## 📌 UI Features

- 3D Interactive Force Graph
- Red/Green node risk indicators
- Toggle “Show Only Fraud Nodes”
- Edge highlighting for selected accounts
- Node Inspector panel with SHAP-based explanations
- Camera zoom & focus on click

## 🏆 Demo Narrative

**“It is the transaction network.
Red nodes are anomalous according to EIF.
Clicking a node focuses the camera and shows why it was flagged — directly tying visuals to explainable AI.”**

## 👩‍💻 Author

**Rupali**  
**Data Visualization & Analytics Specialist**  
Mule Hunter Project
