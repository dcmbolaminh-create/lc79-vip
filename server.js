const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN = "@vanminh2603";

app.use(cors());
app.use(express.json());

const axiosInstance = axios.create({
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
});

// ================= GET DATA =================
async function getSessions(url) {
    try {
        const res = await axiosInstance.get(url);
        return res.data?.list || [];
    } catch {
        return [];
    }
}

// ================= AI TÀI XỈU =================
function duDoanTaiXiu(history) {
    if (!history || history.length < 5) {
        return { prediction: "Đợi", confidence: 40, pattern: null, reason: "Thiếu data", recommend: "Chờ" };
    }

    const seq = history.map(r => (r || "").toLowerCase().includes("tai") ? "T" : "X");
    const last = seq[seq.length - 1];

    let prediction = last === "T" ? "Tài" : "Xỉu";
    let confidence = 55;
    let pattern = "Thường";
    let reason = "Theo nhịp";

    // ===== bệt =====
    let streak = 1;
    for (let i = seq.length - 2; i >= 0; i--) {
        if (seq[i] === last) streak++;
        else break;
    }

    if (streak >= 4) {
        pattern = "Cầu bệt";
        confidence = Math.min(80, 50 + streak * 5);

        let changes = 0;
        const last10 = seq.slice(-10);
        for (let i = 1; i < last10.length; i++) {
            if (last10[i] !== last10[i - 1]) changes++;
        }

        if (changes >= 3 && streak >= 5) {
            prediction = last === "T" ? "Xỉu" : "Tài";
            confidence = 67;
            reason = "Bẻ cầu";
        } else {
            reason = "Theo bệt";
        }
    }

    // ===== zigzag =====
    let zigzag = true;
    const last6 = seq.slice(-6);
    for (let i = 1; i < last6.length; i++) {
        if (last6[i] === last6[i - 1]) zigzag = false;
    }

    if (zigzag) {
        pattern = "Zigzag";
        prediction = last === "T" ? "Xỉu" : "Tài";
        confidence = 64;
        reason = "Đảo cầu";
    }

    // ===== adaptive =====
    const last15 = seq.slice(-15);
    const t = last15.filter(x => x === "T").length;
    const x = last15.length - t;

    if (Math.abs(t - x) >= 4) {
        prediction = t > x ? "Tài" : "Xỉu";
        confidence = Math.max(confidence, 70);
        reason += ` | Học cầu (${t}T-${x}X)`;
    }

    return { prediction, confidence, pattern, reason, recommend: "Đánh nhẹ" };
}

// ================= MARKOV XÚC XẮC =================
function duDoanXucXac(history) {
    if (!history || history.length < 10) {
        return { prediction: [3,3,3], confidence: 30 };
    }

    const sums = history.map(d => d[0]+d[1]+d[2]);
    const map = {};

    for (let i = 0; i < sums.length - 1; i++) {
        if (!map[sums[i]]) map[sums[i]] = [];
        map[sums[i]].push(sums[i+1]);
    }

    const last = sums[sums.length - 1];
    const nextList = map[last] || [];

    let avg = 10;
    if (nextList.length) {
        avg = Math.round(nextList.reduce((a,b)=>a+b,0)/nextList.length);
    }

    let d1 = Math.floor(avg/3);
    let d2 = Math.floor(avg/3);
    let d3 = avg - d1 - d2;

    return {
        prediction: [d1,d2,d3],
        confidence: Math.min(85, 40 + nextList.length)
    };
}

// ================= WIN/LOSE =================
function danhGiaWinLose(sessions, limit = 20) {
    let win = 0, lose = 0;

    for (let i = 0; i < limit; i++) {
        const future = sessions[i];
        const history = sessions.slice(i + 1).map(s => s.resultTruyenThong || "");

        if (!future || history.length < 5) continue;

        const duDoan = duDoanTaiXiu(history);
        const real = (future.resultTruyenThong || "").toLowerCase().includes("tai") ? "Tài" : "Xỉu";

        if (duDoan.prediction === real) win++;
        else lose++;
    }

    const total = win + lose;
    return {
        tong_so: total,
        thang: win,
        thua: lose,
        ty_le_thang: total ? Math.round(win / total * 100) + "%" : "0%"
    };
}

// ================= BUILD =================
function build(latest, sessions) {
    const history = sessions.map(s => s.resultTruyenThong || "");
    const diceHistory = sessions.map(s => s.dices || [0,0,0]);

    const tx = duDoanTaiXiu(history);
    const dice = duDoanXucXac(diceHistory);
    const dg = danhGiaWinLose(sessions, 20);

    const dices = latest.dices || [0,0,0];

    return {
        admin: ADMIN,

        phien: Number(latest.id || 0),
        xuc_xac_1: dices[0],
        xuc_xac_2: dices[1],
        xuc_xac_3: dices[2],
        tong: Number(latest.point || 0),
        ket_qua: latest.resultTruyenThong || "Chưa có",
        phien_hien_tai: Number(latest.id || 0) + 1,

        du_doan: tx.prediction,
        do_tin_cay: tx.confidence,
        pattern: tx.pattern,
        reason: tx.reason,
        recommend: tx.recommend,

        xuc_xac_du_doan: dice.prediction,
        xuc_xac_tin_cay: dice.confidence,

        danh_gia: dg
    };
}

// ================= API =================
app.get('/taixiumd5', async (req, res) => {
    const s = await getSessions('https://wtxmd52.tele68.com/v1/txmd5/sessions');
    res.json(build(s[0] || {}, s));
});

app.get('/taixiu', async (req, res) => {
    const s = await getSessions('https://wtx.tele68.com/v1/tx/sessions');
    res.json(build(s[0] || {}, s));
});

app.get('/both', async (req, res) => {
    const [md5, tx] = await Promise.all([
        getSessions('https://wtxmd52.tele68.com/v1/txmd5/sessions'),
        getSessions('https://wtx.tele68.com/v1/tx/sessions')
    ]);

    res.json({
        admin: ADMIN,
        taixiumd5: build(md5[0] || {}, md5),
        taixiu: build(tx[0] || {}, tx)
    });
});

app.listen(PORT, () => console.log("🚀 RUN PORT", PORT));
