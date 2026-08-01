# 🎯 Mule Hunter Engine

<div align="center">

### **Defense in Depth: Real-Time Financial Fraud Detection Platform**
*Stopping money mule networks before they cash out*

---

## 🌐 Local Deployment & Demo

**Access the local application dashboard here:**

**[http://localhost:3000](http://localhost:3000)**

## 🔐 Admin Panel Credentials

Use the following credentials to access the admin panel after logging in:

**Email:** user@test.com  
**Password:** userPassword

> ⚠️ **Note:** These credentials are provided for testing purposes during the demo.

</div>

---

## 📋 Table of Contents

- [The Problem](#-the-problem)
- [Our Solution](#-our-solution-defense-in-depth)
- [Verified Performance](#-verified-performance)
- [System Architecture](#-system-architecture)
- [Extremely Detailed Setup Guide](#-extremely-detailed-setup-guide)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Database (Docker MongoDB)](#2-database-docker-mongodb)
  - [3. Frontend Configuration (.env.local)](#3-frontend-configuration-envlocal)
  - [4. Backend Configuration (application.properties)](#4-backend-configuration-applicationproperties)
  - [5. Seeding Graph Data](#5-seeding-graph-data)
  - [6. AI Engine Setup (PyTorch & PyG)](#6-ai-engine-setup-pytorch--pyg)
  - [7. Booting the System](#7-booting-the-system)
- [Team](#-team)

---

## 🚨 The Problem

India's UPI network processes **500 crore+ transactions per month**. Even 0.1% fraud equals **50 lakh fraudulent transactions**. At global scale, money laundering moves an estimated **$3 trillion annually**. Modern financial crime no longer looks like a single suspicious account. It looks like a **network**.

**Traditional fraud detection cannot see this.** It analyzes accounts in isolation — completely blind to the graph that makes this a crime.

---

## 💡 Our Solution: Defense in Depth

MuleHunter shifts the paradigm from *"does this transaction look suspicious?"* to *"does this entire network of relationships look suspicious?"* by utilizing a Graph Neural Network (GNN) and Extended Isolation Forests (EIF).

---

## 🚀 Extremely Detailed Setup Guide

Follow these precise, minute-detail steps to get the entire Mule Hunter platform running smoothly on your local machine (Windows/Linux/macOS).

### 1. Prerequisites
Ensure you have the following installed before starting:
- **Docker Desktop** (Must be running)
- **Node.js** (v20+ recommended)
- **Java JDK 17** (Must be exactly 17, ensure `JAVA_HOME` is set properly)
- **Python 3.11** (Required for PyTorch and ML dependencies)
- **Maven** (For building the Spring Boot backend)

### 2. Database (Docker MongoDB)
We use a local Docker container for the database.
1. Open your terminal or PowerShell.
2. Run the following command to pull and start MongoDB:
   ```bash
   docker run -d -p 27017:27017 --name mule_mongo mongo:latest
   ```
3. Verify it is running by typing `docker ps`. You should see `mule_mongo` active on port 27017.

### 3. Frontend Configuration (.env.local)
The Next.js frontend (`control-tower`) requires a very specific `.env.local` file to communicate with the backend, AI engine, and database.
1. Navigate to the `control-tower` directory.
2. Create a file named `.env.local` and paste the **exact** contents below:
   ```env
   # ─── MuleHunter Control Tower — Local Dev Environment ───
   
   # NextAuth Security
   NEXTAUTH_SECRET=mule-hunter-super-secret-2026-national-demo
   NEXTAUTH_URL=http://localhost:3000
   
   # JWT (for role-based API tokens)
   JWT_SECRET=mule-hunter-jwt-secret-2026-national-presentation
   
   # MongoDB Connection
   MONGODB_URI=mongodb://localhost:27017/mule_hunter_auth
   
   # Backend Links (Spring Boot)
   NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8082
   NEXT_PUBLIC_API_URL=http://localhost:8082
   
   # AI Engine Link (FastAPI)
   NEXT_PUBLIC_ML_URL=http://localhost:8001
   
   # Optional Features
   GROQ_API_KEY=
   NEXT_PUBLIC_EMAILJS_SERVICE_ID=
   NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=
   NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=
   ```

### 4. Backend Configuration (application.properties)
The Spring Boot backend requires its properties to be synced with the local setup.
1. Navigate to `backend/src/main/resources/application.properties`.
2. Ensure the contents match exactly:
   ```properties
   spring.application.name=backend
   jwt.secret=hsdhsu68283hsdbbsdju28e77382327920oddn83t8y3i2nhw8dyy73298329ndw28723h
   visual.internal-api-key=visual-analytics-secret-123
   spring.data.mongodb.uri=mongodb://localhost:27017/mule_hunter_auth
   security.service.url=http://localhost:8081
   ai.service.url=http://localhost:8001
   eif.service.url=http://localhost:8001
   visual.service.url=http://localhost:8000
   spring.mvc.async.request-timeout=-1
   server.port=8082
   ```

### 5. Seeding Graph Data
The database needs the pre-processed graph nodes (14,318 nodes) and transactions (75,488 edges) injected into it.
1. Open a terminal and navigate to the `control-tower/lib` folder:
   ```bash
   cd control-tower/lib
   ```
2. Run the Node seed scripts:
   ```bash
   node --env-file=../.env.local seedDb.js
   node seedUser.js
   ```

### 6. AI Engine Setup (PyTorch & PyG)
🚨 **CRITICAL STEP:** A standard `pip install -r requirements.txt` will FAIL because PyTorch Geometric (PyG) requires pre-compiled C++ sparse backends that match your exact PyTorch version and CPU architecture. Follow this exactly:

1. Open a new terminal and navigate to `ai-engine`:
   ```bash
   cd ai-engine
   ```
2. Create and activate a Python 3.11 virtual environment:
   ```bash
   python -m venv .venv
   # Windows: .venv\Scripts\activate
   # Linux/Mac: source .venv/bin/activate
   ```
3. Install PyTorch first:
   ```bash
   pip install torch==2.3.1
   ```
4. Install the pre-compiled PyG sparse backends specifically for CPU (DO NOT SKIP):
   ```bash
   pip install torch-scatter torch-sparse -f https://data.pyg.org/whl/torch-2.3.1+cpu.html
   ```
5. Install PyTorch Geometric:
   ```bash
   pip install torch-geometric==2.5.3
   ```
6. Install the remaining dependencies:
   ```bash
   pip install fastapi==0.115.0 "uvicorn[standard]==0.30.6" pydantic==2.8.2 pandas==2.2.2 numpy==1.26.4 scikit-learn==1.5.1 networkx==3.3 httpx
   ```

### 7. Booting the System
You need three terminal windows open to run the microservices.

**Terminal 1: AI Engine (FastAPI)**
```bash
cd ai-engine
# Activate your venv here
python -m uvicorn inference_service:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2: Spring Boot Backend**
```bash
cd backend
# Windows Users: Ensure JAVA_HOME is set in PowerShell if not globally configured
$env:JAVA_HOME="C:\Program Files\Java\jdk-17"
mvn spring-boot:run
```

**Terminal 3: Next.js Frontend**
```bash
cd control-tower
npm install
npm run dev
```

### 🎯 You're All Set!
Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)** and log in with the admin credentials!

---

## 👥 Team

| Name | Role | Responsibilities |
|:-----|:-----|:----------------|
| **Muskan** | Lead AI Engineer | GraphSAGE architecture · IEEE-CIS data pipeline · GNN training · inference service |
| **Rupali** | ML & Visualization | Extended Isolation Forest · SHAP explainability · Canvas particle graph |
| **Prisha** | Backend Architect | Spring Boot 14-step pipeline · AI service integration · circuit breakers |
| **Ratnesh** | Security Architect | JA3 TLS fingerprinting · Merkle tree ledger · blockchain forensics |
| **Manya** | Full Stack Lead | Next.js dashboard · real-time UX · all 9 live-wired sections · deployment |
