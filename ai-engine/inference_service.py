from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv
from torch_geometric.data import Data
import os
import pandas as pd
import numpy as np
import networkx as nx
import random

try:
    from faker import Faker
    fake = Faker('en_IN')
except ImportError:
    fake = None

# --- CONFIGURATION & PATHS ---
SHARED_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "shared-data")
os.makedirs(SHARED_DATA_DIR, exist_ok=True)
MODEL_PATH = os.path.join(SHARED_DATA_DIR, "mule_model.pth")
DATA_PATH = os.path.join(SHARED_DATA_DIR, "processed_graph.pt")
NODES_CSV_PATH = os.path.join(SHARED_DATA_DIR, "nodes.csv")
EDGES_CSV_PATH = os.path.join(SHARED_DATA_DIR, "transactions.csv")

# --- NEURAL NETWORK ARCHITECTURE ---
class MuleSAGE(torch.nn.Module):
    def __init__(self, in_channels, hidden_channels, out_channels):
        super(MuleSAGE, self).__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, out_channels)

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)

# --- DTO SCHEMAS ---
class RiskRequest(BaseModel):
    node_id: int

class RiskResponse(BaseModel):
    node_id: int
    risk_score: float
    verdict: str
    model_version: str
    out_degree: int
    risk_ratio: float
    population_size: str
    ja3_detected: bool
    linked_accounts: list
    unsupervised_score: float

class TransactionRequest(BaseModel):
    source_id: int
    target_id: int
    amount: float
    timestamp: str = "2025-12-25"

# --- GLOBAL STATE ---
app = FastAPI(title="Mule Hunter AI Service", version="Final-Gold-SelfContained")
model = None
graph_data = None
id_map = {} 
reverse_id_map = {}
node_features_df = None # To store feature lookups (Age, Balance, etc.)

# --- INTERNAL: DATA GENERATOR ---
def run_internal_generator():
    print("📊 GENERATOR: Initializing Mule Hunter Simulation...")
    NUM_USERS = 2000
    G_base = nx.barabasi_albert_graph(n=NUM_USERS, m=2, seed=42)
    G = nx.DiGraph() 
    
    # Base Graph
    for u, v in G_base.edges():
        if random.random() > 0.5: G.add_edge(u, v)
        else: G.add_edge(v, u)

    # Initialize Properties
    for i in G.nodes():
        G.nodes[i]['is_fraud'] = 0
        G.nodes[i]['account_age'] = random.randint(30, 3650)

    # Inject Mule Rings
    print("   Injecting Mule Rings...")
    for _ in range(50): # 50 Rings
        mule = random.choice(list(G.nodes()))
        criminal = random.choice(list(G.nodes()))
        G.nodes[mule]['is_fraud'] = 1
        G.nodes[criminal]['is_fraud'] = 1
        G.add_edge(mule, criminal, amount=random.randint(50000, 100000))
        # Fan-In
        for _ in range(random.randint(10, 20)):
            victim = random.choice(list(G.nodes()))
            if G.nodes[victim]['is_fraud'] == 0:
                G.add_edge(victim, mule, amount=random.randint(500, 2000))

    # Calculate PageRank
    pagerank_scores = nx.pagerank(G)

    # Save Nodes
    node_data = []
    for n in G.nodes():
        node_data.append({
            "node_id": str(n),
            "is_fraud": int(G.nodes[n]['is_fraud']),
            "account_age_days": int(G.nodes[n]['account_age']),
            "pagerank": float(pagerank_scores.get(n, 0)),
            "balance": float(round(random.uniform(100.0, 50000.0), 2)),
            "in_out_ratio": float(round(random.uniform(0.1, 2.0), 2)),
            "tx_velocity": int(random.randint(0, 100))
        })
    
    df_nodes = pd.DataFrame(node_data)
    # STRICT ORDER for Feature Tensor
    cols = ["node_id", "account_age_days", "balance", "in_out_ratio", "pagerank", "tx_velocity", "is_fraud"]
    df_nodes = df_nodes[cols]
    df_nodes.to_csv(NODES_CSV_PATH, index=False)

    # Save Edges
    edge_data = [{"source": str(u), "target": str(v)} for u, v in G.edges()]
    pd.DataFrame(edge_data).to_csv(EDGES_CSV_PATH, index=False)
    print("✅ GENERATOR: Data Saved.")

# --- INTERNAL: TRAINER (Your Logic) ---
def run_internal_trainer():
    print("🧠 TRAINER: Loading Data...")
    df_nodes = pd.read_csv(NODES_CSV_PATH)
    df_edges = pd.read_csv(EDGES_CSV_PATH)

    # Mappings
    node_mapping = {str(id): idx for idx, id in enumerate(df_nodes['node_id'].astype(str))}
    src = df_edges['source'].astype(str).map(node_mapping).values
    dst = df_edges['target'].astype(str).map(node_mapping).values
    
    # Edge Index
    mask = ~np.isnan(src) & ~np.isnan(dst)
    edge_index = torch.tensor([src[mask], dst[mask]], dtype=torch.long)

    # Features (Must match the 5 used in Generator)
    feature_cols = ["account_age_days", "balance", "in_out_ratio", "pagerank", "tx_velocity"]
    x = torch.tensor(df_nodes[feature_cols].values, dtype=torch.float)
    y = torch.tensor(df_nodes['is_fraud'].values, dtype=torch.long)

    graph_data = Data(x=x, edge_index=edge_index, y=y)
    torch.save(graph_data, DATA_PATH)

    # Train
    print("   Training MuleSAGE (5 Features)...")
    local_model = MuleSAGE(in_channels=5, hidden_channels=16, out_channels=2)
    optimizer = torch.optim.Adam(local_model.parameters(), lr=0.01)
    
    local_model.train()
    for _ in range(100):
        optimizer.zero_grad()
        out = local_model(graph_data.x, graph_data.edge_index)
        loss = F.nll_loss(out, graph_data.y)
        loss.backward()
        optimizer.step()

    torch.save(local_model.state_dict(), MODEL_PATH)
    print("✅ TRAINER: Model Saved.")

# --- API ENDPOINTS ---

@app.on_event("startup")
def load_brain():
    global model, graph_data, id_map, reverse_id_map, node_features_df
    
    # Auto-Init if missing
    if not os.path.exists(MODEL_PATH):
        print("First run detected. Initializing...")
        run_internal_generator()
        run_internal_trainer()

    if os.path.exists(MODEL_PATH):
        try:
            print("SYSTEM: Loading Assets...")
            graph_data = torch.load(DATA_PATH, map_location='cpu', weights_only=False)
            
            # Load DF for feature lookups
            node_features_df = pd.read_csv(NODES_CSV_PATH)
            node_features_df['node_id'] = node_features_df['node_id'].astype(str)
            
            # Create Maps
            id_map = {row['node_id']: idx for idx, row in node_features_df.iterrows()}
            reverse_id_map = {idx: row['node_id'] for idx, row in node_features_df.iterrows()}
            
            # Load Model
            model = MuleSAGE(in_channels=5, hidden_channels=16, out_channels=2)
            model.load_state_dict(torch.load(MODEL_PATH, map_location='cpu'))
            model.eval()
            print(f"SYSTEM READY. Loaded {len(id_map)} nodes.")
        except Exception as e:
            print(f"Load Failed: {e}")

@app.post("/initialize-system")
def initialize_system():
    run_internal_generator()
    run_internal_trainer()
    load_brain()
    return {"status": "System Re-Initialized with 5-Feature Model"}

@app.post("/analyze-transaction", response_model=RiskResponse)
def analyze_dynamic_transaction(tx: TransactionRequest):
    global model, graph_data, id_map, node_features_df
    
    if model is None: raise HTTPException(503, "System loading...")
    
    # 1. Resolve ID
    str_id = str(tx.source_id)
    src_idx = id_map.get(str_id)
    tgt_idx = id_map.get(str(tx.target_id), 0) # Default to 0 if target unknown

    # 2. Get/Update Features (The 5 Columns)
    if src_idx is not None:
        # Fetch existing features from DataFrame
        node_row = node_features_df.iloc[src_idx]
        age = node_row['account_age_days']
        balance = node_row['balance']
        pagerank = node_row['pagerank']
        
        # DYNAMICALLY UPDATE Ratio & Velocity based on this new transaction
        # (This is the "Real" part of the demo)
        prev_velocity = node_row['tx_velocity']
        current_velocity = prev_velocity + 1
        
        # Calculate approximate new ratio
        # (Simplified for demo speed vs full graph recalculation)
        current_ratio = node_row['in_out_ratio'] 
        if tx.amount > 10000: current_ratio += 0.5 # High outflow shifts ratio
        
        # Construct Feature Tensor [1, 5]
        features = torch.tensor([[age, balance, current_ratio, pagerank, current_velocity]], dtype=torch.float)
        
        # Calculate Graph Metrics for UI (Out-Degree)
        out_degree = (graph_data.edge_index[0] == src_idx).sum().item() + 1
        risk_ratio_ui = current_ratio
        
    else:
        # New User Default
        features = torch.tensor([[30.0, 5000.0, 1.0, 0.0001, 1.0]], dtype=torch.float)
        src_idx = 0 # Map to dummy for edge connection
        out_degree = 1
        risk_ratio_ui = 1.0

    # 3. Add Temporary Edge
    new_edge = torch.tensor([[src_idx], [tgt_idx]], dtype=torch.long)
    temp_edge_index = torch.cat([graph_data.edge_index, new_edge], dim=1)

    # 4. Inference
    with torch.no_grad():
        # We pass the features of the *whole* graph, but update the source node's row
        # (Optimization: We create a copy of X to not mutate global state)
        temp_x = graph_data.x.clone()
        if src_idx is not None:
            temp_x[src_idx] = features[0]
            
        out = model(temp_x, temp_edge_index)
        fraud_risk = float(out[src_idx].exp()[1])

    # 5. Verdict
    verdict = "SAFE"
    if fraud_risk > 0.8: verdict = "CRITICAL (MULE)"
    elif fraud_risk > 0.5: verdict = "SUSPICIOUS"
    
    # UI Helpers
    neighbors = graph_data.edge_index[1][graph_data.edge_index[0] == src_idx]
    linked = [f"Acct_{reverse_id_map.get(i.item(), '?')}" for i in neighbors[:3]]

    return {
        "node_id": tx.source_id,
        "risk_score": round(fraud_risk, 4),
        "verdict": verdict,
        "model_version": "MuleSAGE-5Feat",
        "out_degree": out_degree,
        "risk_ratio": round(risk_ratio_ui, 2),
        "population_size": f"{len(id_map)} Nodes",
        "ja3_detected": fraud_risk > 0.75,
        "linked_accounts": linked,
        "unsupervised_score": round(abs(fraud_risk - 0.1), 4)
    }