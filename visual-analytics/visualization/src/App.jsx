import { useState, useEffect } from "react";
import FraudGraph3D from "./components/FraudGraph3D";
import NodeInspector from "./components/NodeInspector";

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [token, setToken] = (useState < string) | (null > null);
  const [loading, setLoading] = useState(true);

  async function getRoleToken() {
    const res = await fetch("https://13.48.249.157:3000/app/api/user/role", {
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error("Auth failed");
    }

    const { roleToken } = await res.json();
    return roleToken;
  }

  useEffect(() => {
    async function initAuth() {
      try {
        const roleToken = await getRoleToken();
        const payload = JSON.parse(atob(roleToken.split(".")[1]));

        if (!["ADMIN", "ANALYST"].includes(payload.role)) {
          document.body.innerHTML = "Access Denied";
          return;
        }

        setToken(roleToken);
      } catch (err) {
        console.error(err);
        document.body.innerHTML = "Unauthorized";
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        Verifying access...
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      <div className="flex-1">
        <FraudGraph3D onNodeSelect={setSelectedNode} token={token} />
      </div>

      <NodeInspector
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}

export default App;
