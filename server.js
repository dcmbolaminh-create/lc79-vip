const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { duDoanTaiXiu } = require('./thuattoan');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===== CONFIG =====
const ADMIN = "@vanminh2603";

// ===== HELPER =====
async function getSessions(url) {
    try {
        const res = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return res.data?.list || [];
    } catch (error) {
        console.error(`❌ Lỗi API ${url}:`, error.message);
        return [];
    }
}

// ===== FORMAT RESPONSE =====
function formatData(latest, history) {
    const dices = latest?.dices || [0, 0, 0];
    const duDoan = duDoanTaiXiu(history);

    return {
        admin: ADMIN,
        phien: Number(latest?.id || 0),
        xuc_xac_1: dices[0],
        xuc_xac_2: dices[1],
        xuc_xac_3: dices[2],
        tong: Number(latest?.point || 0),
        ket_qua: latest?.resultTruyenThong || "Chưa có",
        phien_hien_tai: Number(latest?.id || 0) + 1,
        du_doan: duDoan.prediction,
        do_tin_cay: duDoan.confidence,
        pattern: duDoan.pattern,
        reason: duDoan.reason,
        recommend: duDoan.recommend
    };
}

// ==================== MD5 ====================
app.get('/taixiumd5', async (req, res) => {
    try {
        const sessions = await getSessions('https://wtxmd52.tele68.com/v1/txmd5/sessions');

        if (!sessions.length) {
            return res.status(500).json({
                admin: ADMIN,
                error: "Không lấy được dữ liệu MD5"
            });
        }

        const latest = sessions[0];
        const history = sessions.map(s => s.resultTruyenThong || "");

        res.json(formatData(latest, history));

    } catch (err) {
        res.status(500).json({
            admin: ADMIN,
            error: "Lỗi server MD5"
        });
    }
});

// ==================== TÀI XỈU ====================
app.get('/taixiu', async (req, res) => {
    try {
        const sessions = await getSessions('https://wtx.tele68.com/v1/tx/sessions');

        if (!sessions.length) {
            return res.status(500).json({
                admin: ADMIN,
                error: "Không lấy được dữ liệu Tài Xỉu"
            });
        }

        const latest = sessions[0];
        const history = sessions.map(s => s.resultTruyenThong || "");

        res.json(formatData(latest, history));

    } catch (err) {
        res.status(500).json({
            admin: ADMIN,
            error: "Lỗi server Tài Xỉu"
        });
    }
});

// ==================== BOTH ====================
app.get('/both', async (req, res) => {
    try {
        const [md5Sessions, txSessions] = await Promise.all([
            getSessions('https://wtxmd52.tele68.com/v1/txmd5/sessions'),
            getSessions('https://wtx.tele68.com/v1/tx/sessions')
        ]);

        const md5Latest = md5Sessions[0] || {};
        const txLatest = txSessions[0] || {};

        const md5History = md5Sessions.map(s => s.resultTruyenThong || "");
        const txHistory = txSessions.map(s => s.resultTruyenThong || "");

        res.json({
            admin: ADMIN,
            success: true,
            timestamp: new Date().toISOString(),
            taixiumd5: formatData(md5Latest, md5History),
            taixiu: formatData(txLatest, txHistory)
        });

    } catch (err) {
        res.status(500).json({
            admin: ADMIN,
            success: false,
            error: "Lỗi lấy dữ liệu BOTH"
        });
    }
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        admin: ADMIN,
        message: "🚀 API Tài Xỉu VIP PRO MAX",
        endpoints: {
            "/taixiumd5": "MD5",
            "/taixiu": "Tài Xỉu",
            "/both": "Cả hai"
        }
    });
});

// ==================== START ====================
app.listen(PORT, () => {
    console.log(`🚀 Server chạy: http://localhost:${PORT}`);
});
