require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const casinoRoutes = require('./casinoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

// 💓 Health Check สำหรับ Cron-job กัน Render Free Tier หลับ
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'horizon-casino',
    dbConnected: mongoose.connection.readyState === 1,
    uptimeSec: Math.round(process.uptime())
  });
});

// 🎰 API คาสิโนทั้งหมด
app.use('/api/casino', casinoRoutes);

// 🌐 เสิร์ฟ React Frontend (client/dist) เมื่อ Build ขึ้น Production / Render
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('☕ Horizon Casino API กำลังทำงาน! (รัน npm run dev เพื่อเปิดหน้าเว็บ React หรือ npm run build สำหรับ Production)');
  });
}

async function startServer() {
  if (!MONGO_URI) {
    console.error('❌ ไม่พบค่า MONGO_URI ในไฟล์ .env หรือ Environment Variables');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ เชื่อมต่อ MongoDB สำเร็จแล้ว!');

    app.listen(PORT, () => {
      console.log(`☕🎰 Horizon Casino Server พร้อมใช้งานที่ http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ เชื่อมต่อ MongoDB ไม่สำเร็จ:', err.message);
    process.exit(1);
  }
}

startServer();