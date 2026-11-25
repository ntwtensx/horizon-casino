const express = require('express');
const { User, CasinoState } = require('./models');
const {
  DEFAULT_LANDMARKS_META,
  getMasterStampCatalog,
  getWindowLandmarksStatus,
  formatFriendTitle,
  calculateSlotOutcome
} = require('./eventEngine');

const router = express.Router();

const MAX_WALLET_CAP = 9999999;
const MIN_WALLET_CAP = -9999999;
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

const spinCooldownMap = new Map();
const pinVerifyAttemptMap = new Map();

const setNoCacheHeaders = (res) =>
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store'
  });

const clampCoins = (val) =>
  Math.max(MIN_WALLET_CAP, Math.min(MAX_WALLET_CAP, Math.round(Number(val || 0))));

// 🛡️ เสริม: มอบยศ Discord ผ่าน REST API (ทำงานเฉพาะเมื่อตั้งค่า DISCORD_BOT_TOKEN & DISCORD_GUILD_ID ใน .env)
async function tryAssignDiscordPinRole(userId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const roleId = process.env.CASINO_PIN_ROLE_ID || '1565847680893063278';
  if (!token || !guildId || !roleId || !userId) return;

  try {
    await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.warn('[Discord Role Sync Skipped]:', err.message);
  }
}

// 🏰 โหลดสถานะโลกร่วมของคาสิโนจาก MongoDB (สร้างใหม่ให้อัตโนมัติถ้ายังไม่มี)
async function loadWorldState() {
  let doc = await CasinoState.findOne({ key: 'global' }).lean();
  if (!doc) {
    const initialLandmarks = DEFAULT_LANDMARKS_META.map((m) => ({
      id: m.id,
      ownerId: null,
      ownerName: '',
      tier: 0,
      curtainClosed: false
    }));
    const created = await CasinoState.create({
      key: 'global',
      landmarks: initialLandmarks,
      lostWallets: [],
      timeCapsule: null,
      cursedTipJar: 500,
      soulBonds: {}
    });
    doc = created.toObject();
  }

  // ตรวจสอบให้ครบ 5 โซนเสมอ
  const existingMap = new Map((doc.landmarks || []).map((l) => [l.id, l]));
  const normalizedLandmarks = DEFAULT_LANDMARKS_META.map((meta) => {
    const saved = existingMap.get(meta.id);
    return {
      ...meta,
      ownerId: saved?.ownerId || null,
      ownerName: saved?.ownerName || '',
      tier: Number(saved?.tier || 0),
      curtainClosed: Boolean(saved?.curtainClosed)
    };
  });

  return {
    landmarks: normalizedLandmarks,
    lostWallets: Array.isArray(doc.lostWallets) ? [...doc.lostWallets] : [],
    timeCapsule: doc.timeCapsule ? { ...doc.timeCapsule } : null,
    cursedTipJar: typeof doc.cursedTipJar === 'number' ? doc.cursedTipJar : 500,
    soulBonds: doc.soulBonds && typeof doc.soulBonds === 'object' ? { ...doc.soulBonds } : {}
  };
}

// 💾 บันทึกสถานะโลกร่วมกลับลง MongoDB
async function saveWorldState(stateObj) {
  const leanLandmarks = stateObj.landmarks.map((lm) => ({
    id: lm.id,
    ownerId: lm.ownerId || null,
    ownerName: lm.ownerName || '',
    tier: Number(lm.tier || 0),
    curtainClosed: Boolean(lm.curtainClosed)
  }));

  await CasinoState.findOneAndUpdate(
    { key: 'global' },
    {
      $set: {
        landmarks: leanLandmarks,
        lostWallets: (stateObj.lostWallets || []).slice(-30),
        timeCapsule: stateObj.timeCapsule || null,
        cursedTipJar: Number(stateObj.cursedTipJar || 500),
        soulBonds: stateObj.soulBonds || {}
      }
    },
    { upsert: true }
  );
}

// 📋 ดึงรายชื่อสมาชิกทั้งหมดจากฐานข้อมูล Discord (users)
async function buildPlayersRoster() {
  const dbUsers = await User.find({}).lean();
  const players = dbUsers
    .filter((u) => u && u.discordId)
    .map((u) => {
      const hasSavedPin = Boolean(u.casinoPin && /^\d{4}$/.test(String(u.casinoPin).trim()));
      const cleanStamps = Array.isArray(u.collectedStamps)
        ? u.collectedStamps.filter((id) => id && !String(id).startsWith('ST_'))
        : [];
      const displayName =
        (u.name && u.name.trim()) ||
        (u.nickname && u.nickname.trim()) ||
        (u.username && u.username.trim()) ||
        'สมาชิกคาเฟ่';

      return {
        userId: u.discordId,
        username: (u.username || '').trim() || 'member',
        displayName,
        nickname: (u.nickname || '').trim(),
        avatar: (u.avatarUrl && u.avatarUrl.trim()) || DEFAULT_AVATAR,
        walletBalance: typeof u.walletBalance === 'number' ? u.walletBalance : 0,
        scratchCount: Number(u.scratchCount || 0),
        hasPin: hasSavedPin,
        collectedStamps: cleanStamps
      };
    });

  return players.sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
}

// ==========================================
// 📡 1. ดึงข้อมูลเริ่มต้น (GET /api/casino/init)
// ==========================================
router.get('/init', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const [players, worldState] = await Promise.all([buildPlayersRoster(), loadWorldState()]);
    res.status(200).json({
      ok: true,
      players,
      landmarks: getWindowLandmarksStatus(worldState.landmarks, players),
      tipJar: worldState.cursedTipJar,
      stampCatalog: getMasterStampCatalog()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// 🔐 2. ตั้งรหัส PIN 4 หลักใหม่ (POST /api/casino/set-pin)
// ==========================================
router.post('/set-pin', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const { userId, pin, confirmPin } = req.body || {};
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'ไม่พบรหัสผู้ใช้ค่ะ' });
    }

    const cleanPin = String(pin || '').trim();
    if (!/^\d{4}$/.test(cleanPin) || cleanPin !== String(confirmPin || '').trim()) {
      return res.status(400).json({ ok: false, error: 'รหัสผ่านตัวเลข 4 หลักไม่ถูกต้องหรือไม่ตรงกันค่ะ' });
    }

    const existingDoc = await User.findOne({ discordId: userId }).lean();
    if (!existingDoc) {
      return res.status(404).json({ ok: false, error: 'ไม่พบบัญชีสมาชิก Discord นี้ในฐานข้อมูลค่ะ' });
    }

    if (existingDoc.casinoPin && /^\d{4}$/.test(String(existingDoc.casinoPin).trim())) {
      return res.status(409).json({ ok: false, error: 'บัญชีนี้ตั้งรหัสผ่าน 4 หลักไว้แล้วค่ะ!' });
    }

    await User.findOneAndUpdate({ discordId: userId }, { $set: { casinoPin: cleanPin } });
    tryAssignDiscordPinRole(userId); // ไม่บล็อกการตอบกลับ

    res.status(200).json({ ok: true, userId, hasPin: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'เกิดข้อผิดพลาดในการบันทึกรหัสค่ะ' });
  }
});

// ==========================================
// 🔑 3. ตรวจสอบรหัส PIN 4 หลัก (POST /api/casino/verify-pin)
// ==========================================
router.post('/verify-pin', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const { userId, pin } = req.body || {};
    if (!userId || !pin) return res.status(400).json({ ok: false, valid: false });

    const now = Date.now();
    if (now - (pinVerifyAttemptMap.get(userId) || 0) < 400) {
      return res.status(429).json({ ok: false, valid: false });
    }
    pinVerifyAttemptMap.set(userId, now);

    const cleanPin = String(pin).trim();
    if (!/^\d{4}$/.test(cleanPin)) return res.status(200).json({ ok: true, valid: false });

    const userDoc = await User.findOne({ discordId: userId }).select('casinoPin').lean();
    const isValid = Boolean(userDoc?.casinoPin && String(userDoc.casinoPin).trim() === cleanPin);

    res.status(200).json({ ok: true, valid: isValid });
  } catch (err) {
    res.status(500).json({ ok: false, valid: false, error: err.message });
  }
});

// ==========================================
// 🎰 4. ปั่นสล็อต 3 ช่อง + คำนวณอีเวนท์ + ซิงค์ DB (POST /api/casino/spin)
// ==========================================
router.post('/spin', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const { userId, pin } = req.body || {};
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'กรุณาเลือกรายชื่อก่อนโยกคันโยกสล็อตค่ะ' });
    }

    const now = Date.now();
    if (now - (spinCooldownMap.get(userId) || 0) < 2200) {
      return res.status(429).json({ ok: false, error: 'ใจเย็นๆ นะคะ~ รอให้วงล้อสล็อตพักหายใจสักครู่ค่ะ!' });
    }

    const existingDoc = await User.findOne({ discordId: userId }).lean();
    if (!existingDoc) {
      return res.status(404).json({ ok: false, error: 'ไม่พบข้อมูลบัญชีสมาชิกนี้ค่ะ' });
    }

    if (
      existingDoc.casinoPin &&
      /^\d{4}$/.test(String(existingDoc.casinoPin).trim()) &&
      String(pin || '').trim() !== String(existingDoc.casinoPin).trim()
    ) {
      return res.status(403).json({ ok: false, error: 'รหัสผ่าน 4 หลักไม่ถูกต้อง กรุณายืนยันตัวตนใหม่ค่ะ 🔒' });
    }

    spinCooldownMap.set(userId, now);

    const [roster, worldState] = await Promise.all([buildPlayersRoster(), loadWorldState()]);
    const currentPlayer = roster.find((p) => p.userId === userId);
    const currentBal = Number(currentPlayer?.walletBalance || 0);

    const outcome = calculateSlotOutcome(currentBal, userId, roster, worldState);
    const clampedNewBalance = clampCoins(currentBal + outcome.delta);
    const validStampId =
      outcome.stampId && !String(outcome.stampId).startsWith('ST_') ? String(outcome.stampId) : '';

    const updateQuery = {
      $set: { walletBalance: clampedNewBalance, lastScratchAt: new Date() },
      $inc: { scratchCount: 1 },
      ...(validStampId ? { $addToSet: { collectedStamps: validStampId } } : {})
    };

    const updatedUser = await User.findOneAndUpdate({ discordId: userId }, updateQuery, { new: true });

    const mutationsList = Array.isArray(outcome.friendMutations) ? [...outcome.friendMutations] : [];

    // ⛓️ โซ่ล่ามชะตาทำงาน 1 ครั้งในรอบปั่นถัดไปแล้วสลายตัว
    if (worldState.soulBonds && worldState.soulBonds[userId] && !outcome.isNewSoulBond) {
      const partnerId = worldState.soulBonds[userId];
      delete worldState.soulBonds[userId];
      delete worldState.soulBonds[partnerId];

      if (!mutationsList.some((m) => m.userId === partnerId) && outcome.delta !== 0) {
        const partnerEntry = roster.find((p) => p.userId === partnerId);
        const sharedDelta = Math.round(outcome.delta * 0.5);
        if (partnerEntry && sharedDelta !== 0) {
          mutationsList.push({
            userId: partnerId,
            newBalance: clampCoins(partnerEntry.walletBalance + sharedDelta)
          });
          outcome.equationText += ` ➔ โซ่ล่ามชะตาทำงาน 1 ครั้ง สะเทือนถึง ${formatFriendTitle(partnerEntry)} รับผลครึ่งหนึ่ง ${sharedDelta > 0 ? '+' : ''}${sharedDelta.toLocaleString()} เหรียญ แล้วด้ายแดงก็ขาดลง!`;
        }
      }
    }

    // อัปเดตยอดเงินเพื่อนที่โดนผลกระทบจากอีเวนท์มัลติเพลเยอร์
    const affectedFriends = [];
    if (mutationsList.length > 0) {
      const bulkOps = mutationsList.map((m) => {
        const safeBal = clampCoins(m.newBalance);
        affectedFriends.push({ userId: m.userId, newBalance: safeBal });
        return {
          updateOne: {
            filter: { discordId: m.userId },
            update: { $set: { walletBalance: safeBal } }
          }
        };
      });
      await User.bulkWrite(bulkOps, { ordered: false });
    }

    // บันทึกสถานะโลก (แลนด์มาร์ก / กระเป๋าหล่น / คุกกี้ฝังดิน / กระปุกหมู / โซ่ล่ามชะตา)
    await saveWorldState(worldState);

    const cleanUserStamps = Array.isArray(updatedUser?.collectedStamps)
      ? updatedUser.collectedStamps.filter((id) => id && !String(id).startsWith('ST_'))
      : [];

    res.status(200).json({
      ok: true,
      userId,
      previousBalance: currentBal,
      newBalance: updatedUser.walletBalance,
      scratchCount: updatedUser.scratchCount,
      outcome,
      unlockedStampId: validStampId || null,
      collectedStamps: cleanUserStamps,
      affectedFriends,
      landmarks: getWindowLandmarksStatus(worldState.landmarks, roster),
      tipJar: worldState.cursedTipJar
    });
  } catch (err) {
    console.error('[Casino Spin Error]:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;