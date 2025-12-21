from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv
import os

#CONFIG
SHARED_DATA_DIR = "/app/shared-data"
MODEL_PATH = os.path.join(SHARED_DATA_DIR, "mule_model.pth")
DATA_PATH = os.path.join(SHARED_DATA_DIR, "processed_graph.pt")

# DEFINING THE BRAIN ARCHITECTURE 
# We must redefine the class so PyTorch knows what "MuleSAGE" means
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

# INITIALIZING THE APP 
app = FastAPI(title="Mule Hunter AI Engine")

# Global variables to hold the brain in memory
model = None
graph_data = None

@app.on_event("startup")
def load_brain():
    global model, graph_data
    print("🧠 Waking up the Mule Hunter Brain...")
    
    if not os.path.exists(MODEL_PATH) or not os.path.exists(DATA_PATH):
        raise FileNotFoundError("❌ Model or Data not found! Run train_model.py first.")

    # 1. Load Data (to get features)
    # weights_only=False is required for complex Graph objects
    graph_data = torch.load(DATA_PATH, weights_only=False)
    
    # 2. Load Model
    model = MuleSAGE(in_channels=5, hidden_channels=16, out_channels=2)
    model.load_state_dict(torch.load(MODEL_PATH, weights_only=True))
    model.eval() # Set to "Evaluation Mode" (No learning, just predicting)
    
    print(" Brain is active and listening on Port 8000.")

@app.get("/")
def health_check():
    return {"status": "active", "model": "MuleSAGE v1"}

@app.get("/predict/{node_id}")
def predict_risk(node_id: int):
    """
    Input: Node ID (e.g., 500)
    Output: Risk Score (0 to 1) and Label
    """
    global model, graph_data
    
    # Validation: Does this user exist?
    if node_id >= graph_data.num_nodes:
        raise HTTPException(status_code=404, detail="User ID not found in graph")

    # 1. Get the specific features for this user
    # We pass the WHOLE graph, but we only care about the result for 'node_id'
    # In a real GNN, we need neighbors, so we pass everything.
    with torch.no_grad():
        out = model(graph_data.x, graph_data.edge_index)
        
        # Get the probability for THIS specific node
        # exp() converts log_softmax back to normal probability (0.0 to 1.0)
        probs = out[node_id].exp() 
        
        # Class 1 is Fraud. Let's get that probability.
        fraud_risk = float(probs[1])
        
    # 2. Determine Verdict
    verdict = "SAFE"
    if fraud_risk > 0.75:
        verdict = "HIGH RISK (MULE)"
    elif fraud_risk > 0.4:
        verdict = "SUSPICIOUS"

    return {
        "node_id": node_id,
        "risk_score": round(fraud_risk, 4),
        "verdict": verdict
    }

