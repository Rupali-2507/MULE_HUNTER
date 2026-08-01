const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const NodeSchema = new mongoose.Schema({}, { strict: false });
const Node = mongoose.models.Node || mongoose.model('Node', NodeSchema);

const TransactionSchema = new mongoose.Schema({}, { strict: false });
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);

async function seed() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGODB_URI not found in env");

        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const publicDir = path.join(__dirname, '..', '..', 'shared-data');
        
        const nodesPath = path.join(publicDir, 'nodes.csv'); 
        const fraudPath = path.join(publicDir, 'fraud_explanations.json'); // Might not exist
        const shapPath = path.join(publicDir, 'shap_explanations.json'); // Might not exist
        const txPath = path.join(publicDir, 'transactions.csv');

        [nodesPath, txPath].forEach(p => {
            if (!fs.existsSync(p)) {
                console.error(`❌ Missing: ${p}`);
                process.exit(1);
            }
        });


        const nodes = [];
        console.log('Parsing files from /public...');

        fs.createReadStream(nodesPath)
            .pipe(csv())
            .on('data', (row) => nodes.push(row))
            .on('end', async () => {
                let fraudData = [];
                let shapData = [];
                try { if (fs.existsSync(fraudPath)) fraudData = JSON.parse(fs.readFileSync(fraudPath, 'utf8')); } catch (e) {}
                try { if (fs.existsSync(shapPath)) shapData = JSON.parse(fs.readFileSync(shapPath, 'utf8')); } catch (e) {}

                const nodeDocuments = nodes.map(n => {
                    const fraud = fraudData.find(f => f.node_id == n.node_id);
                    const shap = shapData.find(s => s.node_id == n.node_id);
                    return {
                        ...n,
                        node_id: parseInt(n.node_id),
                        is_anomalous: n.is_anomalous ? parseInt(n.is_anomalous) : 0,
                        anomaly_score: n.anomaly_score ? parseFloat(n.anomaly_score) : 0.0,
                        reasons: fraud ? fraud.reasons : [],
                        shap_factors: shap ? shap.top_factors : []
                    };
                });


                await Node.deleteMany({}); 
                await Node.insertMany(nodeDocuments);
                console.log(`✅ Seeded ${nodeDocuments.length} Nodes`);

                const txs = [];
                fs.createReadStream(txPath)
                    .pipe(csv())
                    .on('data', (data) => txs.push(data))
                    .on('end', async () => {
                        await Transaction.deleteMany({});
                        await Transaction.insertMany(txs);
                        console.log(`✅ Seeded ${txs.length} Transactions`);
                        process.exit(0);
                    });
            });

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

seed();

// run using this command : 
// node --env-file=../.env.local seedDb.js