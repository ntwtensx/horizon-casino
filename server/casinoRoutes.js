const crypto = require('crypto');
const express = require('express');
const { User, CasinoState } = require('./models');
const {
  DEFAULT_LANDMARKS_META,
  getMasterStampCatalog,
  getWindowLandmarksStatus,
  formatFriendTitle,
  calculateSlotOutcome
} = require('./eventEngine');
const {
  DEPOSIT_FEE_RATE,
  MAX_STATEMENT_ITEMS,
  clampCoins,
  clampBank,
  calculateSpinFee,
  buildTransaction,
  applyBalanceDelta,
  calculateDeposit,
  calculateWithdraw
} = require('./utils/economy');

const router = express.Router();

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

// 🤖 ข้อมูลประจำตัวของ "น้องคอร์นจ๊อบ" (บอทปลุกเว็บ & ผู้เล่นอัตโนมัติ)
const CRON_BOT_ID = 'bot_cronjob';
const CRON_BOT_PROFILE = {
  discordId: CRON_BOT_ID,
  accountType: 'bot',
  name: 'น้องคอร์นจ๊อบ',
  nickname: 'น้องคอร์นจ๊อบ',
  username: 'cronjob_bot',
  avatarUrl: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=NongCronJob&backgroundColor=fcefd6'
};
const CRON_SPIN_COOLDOWN_MS = 8 * 60 * 1000;

const spinCooldownMap = new Map();
const pinVerifyAttemptMap = new Map();
const registerRateMap = new Map();

const setNoCacheHeaders = (res) =>
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store'
  });

const escapeRegex = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isBotAccount = (userDoc, userId = '') =>
  Boolean(
    userDoc?.accountType === 'bot' ||
      String(userId || userDoc?.discordId || '').startsWith('bot_')
  );

function isPinAuthorized(userDoc, rawPin) {
  if (!userDoc?.casinoPin || !/^\d{4}$/.test(String(userDoc.casinoPin).trim())) return true;
  return String(rawPin || '').trim() === String(userDoc.casinoPin).trim();
}

async function tryAssignDiscordPinRole(userId) {
  if (!userId || String(userId).startsWith('web_') || String(userId).startsWith('bot_')) return;
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const roleId = process.env.CASINO_PIN_ROLE_ID || '1565847680893063278';
  if (!token || !guildId || !roleId) return;

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

async function ensureCronBotUser() {
  let doc = await User.findOne({ discordId: CRON_BOT_ID }).lean();
  if (!doc) {
    const created = await User.create({
      ...CRON_BOT_PROFILE,
      walletBalance: 500,
      bankBalance: 0,
      casinoPin: '',
      scratchCount: 0,
      collectedStamps: [],
      transactions: [
        buildTransaction({
          type: 'SPIN_WIN',
          title: '🤖 น้องคอร์นจ๊อบเข้าประจำการปลุกคาเฟ่ (ทุนตั้งต้น)',
          walletDelta: 500,
          bankDelta: 0,
          walletAfter: 500,
          bankAfter: 0
        })
      ]
    });
    doc = created.toObject();
  }
  return doc;
}

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
      cursedTipJar: 400,
      soulBonds: {}
    });
    doc = created.toObject();
  }

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
    cursedTipJar: typeof doc.cursedTipJar === 'number' ? doc.cursedTipJar : 400,
    soulBonds: doc.soulBonds && typeof doc.soulBonds === 'object' ? { ...doc.soulBonds } : {}
  };
}

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
        cursedTipJar: Number(stateObj.cursedTipJar || 400),
        soulBonds: stateObj.soulBonds || {}
      }
    },
    { upsert: true }
  );
}

function formatPlayerDoc(u) {
  const hasSavedPin = Boolean(u.casinoPin && /^\d{4}$/.test(String(u.casinoPin).trim()));
  const cleanStamps = Array.isArray(u.collectedStamps)
    ? u.collectedStamps.filter((id) => id && !String(id).startsWith('ST_'))
    : [];
  const displayName =
    (u.name && u.name.trim()) ||
    (u.nickname && u.nickname.trim()) ||
    (u.username && u.username.trim()) ||
    'สมาชิกคาเฟ่';
  const accountType =
    u.accountType ||
    (String(u.discordId || '').startsWith('bot_')
      ? 'bot'
      : String(u.discordId || '').startsWith('web_')
        ? 'web'
        : 'discord');

  return {
    userId: u.discordId,
    accountType,
    username: (u.username || '').trim() || 'member',
    displayName,
    nickname: (u.nickname || '').trim(),
    avatar: (u.avatarUrl && u.avatarUrl.trim()) || DEFAULT_AVATAR,
    walletBalance: typeof u.walletBalance === 'number' ? u.walletBalance : 0,
    bankBalance: clampBank(u.bankBalance || 0),
    scratchCount: Number(u.scratchCount || 0),
    hasPin: accountType === 'bot' ? true : hasSavedPin,
    collectedStamps: cleanStamps
  };
}

async function buildPlayersRoster() {
  const dbUsers = await User.find({}).select('-transactions').lean();
  const players = dbUsers.filter((u) => u && u.discordId).map(formatPlayerDoc);
  return players.sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
}

// ==========================================
// ⚙️ แกนกลางปั่นสล็อต (ใช้ร่วมกันทั้งผู้เล่นจริงและน้องคอร์นจ๊อบ + ค่าตั๋วขั้นบันได + เจาะธนาคาร)
// ==========================================
async function executeSlotSpin({ userId, existingDoc, isBot = false }) {
  const [roster, worldState] = await Promise.all([buildPlayersRoster(), loadWorldState()]);
  const currentPlayer = roster.find((p) => p.userId === userId) || formatPlayerDoc(existingDoc);
  const currentWallet = Number(currentPlayer?.walletBalance ?? existingDoc.walletBalance ?? 0);
  const currentBank = clampBank(currentPlayer?.bankBalance ?? existingDoc.bankBalance ?? 0);

  // 🎟️ 1. หักค่าตั๋วโยกสล็อตแบบขั้นบันได (คนติดหนี้/หมดตัวฟรี 0 เหรียญ • คนรวยจ่ายและเผาทิ้ง 100%)
  const spinFee = calculateSpinFee(currentWallet, currentBank);
  const feeCalc =
    spinFee > 0
      ? applyBalanceDelta({
          walletBalance: currentWallet,
          bankBalance: currentBank,
          delta: -spinFee,
          walletOnly: false
        })
      : { newWallet: currentWallet, newBank: currentBank, usedBank: 0 };

  // อัปเดตยอดหลังจ่ายค่าตั๋วให้ roster ชั่วคราวก่อนส่งเข้าเครื่องยนต์
  const adjustedRoster = roster.map((p) =>
    p.userId === userId ? { ...p, walletBalance: feeCalc.newWallet, bankBalance: feeCalc.newBank } : p
  );

  // 🎰 2. สุ่มผลสล็อต 3 ช่องตามกติกาสายโหด
  const outcome = calculateSlotOutcome(feeCalc.newWallet, userId, adjustedRoster, worldState);

  // 💸 3. คำนวณการเปลี่ยนยอด 2 บัญชี (รองรับ walletOnly, bankDirect และ seizeBank)
  const balCalc = applyBalanceDelta({
    walletBalance: feeCalc.newWallet,
    bankBalance: feeCalc.newBank,
    delta: outcome.delta,
    walletOnly: Boolean(outcome.walletOnly),
    seizeBank: Boolean(outcome.seizeBank),
    bankDirect: Boolean(outcome.bankDirect)
  });

  const finalWallet = balCalc.newWallet;
  const finalBank = balCalc.newBank;
  const totalWalletDelta = finalWallet - currentWallet;
  const totalBankDelta = finalBank - currentBank;
  const totalUsedBank = Number(feeCalc.usedBank || 0) + Number(balCalc.usedBank || 0);

  if (balCalc.usedBank > 0 && !outcome.seizeBank && !outcome.bankDirect) {
    outcome.equationText += ` ➔ (เงินกระเป๋าไม่พอ ระบบดึงจากธนาคารมาช่วยจ่าย -${balCalc.usedBank.toLocaleString()} เหรียญ)`;
  }

  if (spinFee > 0) {
    outcome.equationText += ` • 🎟️ ค่าตั๋วโยกสล็อต -${spinFee.toLocaleString()} เหรียญ (เผาลดเงินเฟ้อ)`;
    const prevSink = outcome.sinkInfo || { tipPct: 0, toTipJar: 0, burned: 0 };
    outcome.sinkInfo = {
      ...prevSink,
      burned: Number(prevSink.burned || 0) + spinFee
    };
  }

  const validStampId =
    outcome.stampId && !String(outcome.stampId).startsWith('ST_') ? String(outcome.stampId) : '';

  const netPlayerChange = totalWalletDelta + totalBankDelta;
  const playerTxType =
    outcome.txType || (netPlayerChange > 0 ? 'SPIN_WIN' : netPlayerChange < 0 ? 'SPIN_LOSS' : 'SPIN_ZERO');

  const playerTx = buildTransaction({
    type: playerTxType,
    title: outcome.headline || outcome.categoryHeader || '🎰 ผลลัพธ์สล็อตคาเฟ่',
    walletDelta: totalWalletDelta,
    bankDelta: totalBankDelta,
    walletAfter: finalWallet,
    bankAfter: finalBank,
    burned: Number(outcome.sinkInfo?.burned || 0)
  });

  const updateQuery = {
    $set: {
      walletBalance: finalWallet,
      bankBalance: finalBank,
      lastScratchAt: new Date()
    },
    $inc: { scratchCount: 1 },
    ...(validStampId ? { $addToSet: { collectedStamps: validStampId } } : {}),
    ...(netPlayerChange !== 0 || outcome.seizeBank
      ? { $push: { transactions: { $each: [playerTx], $slice: -MAX_STATEMENT_ITEMS } } }
      : {})
  };

  let updatedUser = await User.findOneAndUpdate({ discordId: userId }, updateQuery, { new: true });

  // 🏦 นิสัยน้องคอร์นจ๊อบ: ถ้ารวยเกิน 2,500 เหรียญในกระเป๋า มีโอกาส 35% แวะฝากธนาคาร 40% เอง
  let botAutoDeposit = null;
  if (isBot && updatedUser && updatedUser.walletBalance >= 2500 && Math.random() < 0.35) {
    const depAmount = Math.floor(updatedUser.walletBalance * 0.4);
    const depCalc = calculateDeposit(updatedUser.walletBalance, updatedUser.bankBalance, depAmount);
    if (depCalc.ok) {
      updatedUser = await User.findOneAndUpdate(
        { discordId: userId },
        {
          $set: { walletBalance: depCalc.newWallet, bankBalance: depCalc.newBank },
          $push: { transactions: { $each: [depCalc.tx], $slice: -MAX_STATEMENT_ITEMS } }
        },
        { new: true }
      );
      botAutoDeposit = { amount: depCalc.amount, credited: depCalc.credited, fee: depCalc.fee };
    }
  }

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
        const myTitle = formatFriendTitle(currentPlayer);
        mutationsList.push({
          userId: partnerId,
          fallbackName: partnerEntry.displayName,
          mode: 'DELTA',
          delta: sharedDelta,
          walletOnly: false,
          txType: sharedDelta >= 0 ? 'FRIEND_IN' : 'FRIEND_OUT',
          reason: `⛓️ โซ่ล่ามชะตากับ ${myTitle} ทำงาน (รับผล 50%)`
        });
        outcome.equationText += ` ➔ โซ่ล่ามชะตาทำงาน 1 ครั้ง สะเทือนถึง ${formatFriendTitle(partnerEntry)} รับผลครึ่งหนึ่ง ${sharedDelta > 0 ? '+' : ''}${sharedDelta.toLocaleString()} เหรียญ แล้วด้ายแดงก็ขาดลง!`;
      }
    }
  }

  // 🧾 อัปเดตยอดเงินและลงเดินบัญชีให้เพื่อนที่ได้รับผลกระทบ
  const affectedFriends = [];
  if (mutationsList.length > 0) {
    const rosterMap = new Map(roster.map((p) => [p.userId, p]));
    const bulkOps = [];

    for (const m of mutationsList) {
      const target = rosterMap.get(m.userId);
      const fWallet = Number(target?.walletBalance || 0);
      const fBank = clampBank(target?.bankBalance || 0);

      let fCalc;
      if (m.mode === 'SET') {
        const safeWallet = clampCoins(m.newBalance);
        fCalc = {
          newWallet: safeWallet,
          newBank: fBank,
          walletDelta: safeWallet - fWallet,
          bankDelta: 0
        };
      } else {
        fCalc = applyBalanceDelta({
          walletBalance: fWallet,
          bankBalance: fBank,
          delta: Number(m.delta || 0),
          walletOnly: Boolean(m.walletOnly)
        });
      }

      const fTx = buildTransaction({
        type: m.txType || (fCalc.walletDelta + fCalc.bankDelta >= 0 ? 'FRIEND_IN' : 'FRIEND_OUT'),
        title: m.reason || 'รายการจากเพื่อนในคาเฟ่',
        walletDelta: fCalc.walletDelta,
        bankDelta: fCalc.bankDelta,
        walletAfter: fCalc.newWallet,
        bankAfter: fCalc.newBank
      });

      affectedFriends.push({
        userId: m.userId,
        newBalance: fCalc.newWallet,
        newBankBalance: fCalc.newBank
      });

      bulkOps.push({
        updateOne: {
          filter: { discordId: m.userId },
          update: {
            $set: { walletBalance: fCalc.newWallet, bankBalance: fCalc.newBank },
            $push: { transactions: { $each: [fTx], $slice: -MAX_STATEMENT_ITEMS } }
          }
        }
      });
    }

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps, { ordered: false });
    }
  }

  await saveWorldState(worldState);

  const cleanUserStamps = Array.isArray(updatedUser?.collectedStamps)
    ? updatedUser.collectedStamps.filter((id) => id && !String(id).startsWith('ST_'))
    : [];

  return {
    ok: true,
    userId,
    previousBalance: currentWallet,
    newBalance: updatedUser.walletBalance,
    previousBankBalance: currentBank,
    newBankBalance: clampBank(updatedUser.bankBalance),
    walletDelta: totalWalletDelta,
    bankDelta: totalBankDelta,
    usedBank: totalUsedBank,
    spinFee,
    scratchCount: updatedUser.scratchCount,
    outcome,
    unlockedStampId: validStampId || null,
    collectedStamps: cleanUserStamps,
    transactions: [...(updatedUser.transactions || [])].reverse(),
    affectedFriends,
    landmarks: getWindowLandmarksStatus(worldState.landmarks, roster),
    tipJar: worldState.cursedTipJar,
    ...(botAutoDeposit ? { botAutoDeposit } : {})
  };
}

// ==========================================
// ⏰ 0. ระบบปลุกเว็บ + น้องคอร์นจ๊อบโยกสล็อตอัตโนมัติ (GET /api/casino/cron-wake)
// ==========================================
router.get('/cron-wake', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const requiredSecret = String(process.env.CRON_SECRET || '').trim();
    if (requiredSecret && String(req.query.key || '').trim() !== requiredSecret) {
      return res.status(403).json({ ok: false, error: 'CRON_SECRET ไม่ถูกต้องค่ะ' });
    }

    const botDoc = await ensureCronBotUser();

    const lastSpinMs = botDoc.lastScratchAt ? new Date(botDoc.lastScratchAt).getTime() : 0;
    const elapsedMs = Date.now() - lastSpinMs;
    if (lastSpinMs > 0 && elapsedMs < CRON_SPIN_COOLDOWN_MS) {
      const waitSec = Math.ceil((CRON_SPIN_COOLDOWN_MS - elapsedMs) / 1000);
      return res.status(200).json({
        ok: true,
        awake: true,
        spun: false,
        botName: CRON_BOT_PROFILE.name,
        message: `เว็บตื่นแล้วค่ะ! น้องคอร์นจ๊อบเพิ่งโยกไปเมื่อสักครู่ (พักจิบกาแฟอีก ${waitSec} วินาที)`,
        nextSpinInSec: waitSec,
        walletBalance: botDoc.walletBalance,
        bankBalance: clampBank(botDoc.bankBalance),
        scratchCount: Number(botDoc.scratchCount || 0)
      });
    }

    const spinPayload = await executeSlotSpin({
      userId: CRON_BOT_ID,
      existingDoc: botDoc,
      isBot: true
    });

    console.log(
      `🤖 [Cron-Wake] น้องคอร์นจ๊อบโยกรอบที่ #${spinPayload.scratchCount}: ${spinPayload.outcome.headline} (Wallet: ${spinPayload.newBalance}, Bank: ${spinPayload.newBankBalance})`
    );

    res.status(200).json({
      ok: true,
      awake: true,
      spun: true,
      botName: CRON_BOT_PROFILE.name,
      spinNumber: spinPayload.scratchCount,
      event: {
        category: spinPayload.outcome.categoryHeader,
        headline: spinPayload.outcome.headline,
        delta: spinPayload.outcome.delta,
        walletDelta: spinPayload.walletDelta,
        bankDelta: spinPayload.bankDelta
      },
      walletBalance: spinPayload.newBalance,
      bankBalance: spinPayload.newBankBalance,
      collectedStampsCount: spinPayload.collectedStamps.length,
      affectedFriendsCount: spinPayload.affectedFriends.length,
      botAutoDeposit: spinPayload.botAutoDeposit || null
    });
  } catch (err) {
    console.error('[Cron-Wake Error]:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

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
      depositFeePct: Math.round(DEPOSIT_FEE_RATE * 100),
      stampCatalog: getMasterStampCatalog()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// ✨ 2. สมัครบัญชีผู้เล่นใหม่จากหน้าเว็บ (POST /api/casino/register)
// ==========================================
router.post('/register', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const clientIp =
      String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
        .split(',')[0]
        .trim();

    const now = Date.now();
    const recentHits = (registerRateMap.get(clientIp) || []).filter((ts) => now - ts < 60 * 60 * 1000);
    if (recentHits.length >= 6) {
      return res.status(429).json({
        ok: false,
        error: 'มีการสมัครสมาชิกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่นะคะ'
      });
    }

    const { displayName, pin, confirmPin, avatarUrl } = req.body || {};
    const cleanName = String(displayName || '').trim().replace(/\s+/g, ' ');
    const cleanPin = String(pin || '').trim();
    const cleanConfirm = String(confirmPin || '').trim();

    if (cleanName.length < 2 || cleanName.length > 24) {
      return res.status(400).json({ ok: false, error: 'กรุณาตั้งชื่อความยาว 2 ถึง 24 ตัวอักษรค่ะ' });
    }

    if (!/^\d{4}$/.test(cleanPin) || cleanPin !== cleanConfirm) {
      return res.status(400).json({ ok: false, error: 'กรุณาตั้งรหัส PIN ตัวเลข 4 หลักและยืนยันให้ตรงกันค่ะ' });
    }

    const dupRegex = new RegExp(`^${escapeRegex(cleanName)}$`, 'i');
    const duplicate = await User.findOne({
      $or: [{ name: dupRegex }, { nickname: dupRegex }]
    })
      .select('discordId')
      .lean();

    if (duplicate) {
      return res.status(409).json({
        ok: false,
        error: `ชื่อ "${cleanName}" มีสมาชิกใช้งานแล้ว กรุณาใช้ชื่ออื่นนะคะ`
      });
    }

    const safeAvatar =
      typeof avatarUrl === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(avatarUrl.trim())
        ? avatarUrl.trim().slice(0, 300)
        : `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=f3e7d8`;

    const webId = `web_${crypto.randomBytes(6).toString('hex')}`;
    const webHandle = `guest_${crypto.randomBytes(3).toString('hex')}`;

    const createdDoc = await User.create({
      discordId: webId,
      accountType: 'web',
      name: cleanName,
      nickname: cleanName,
      username: webHandle,
      avatarUrl: safeAvatar,
      walletBalance: 0,
      bankBalance: 0,
      casinoPin: cleanPin,
      scratchCount: 0,
      collectedStamps: [],
      transactions: []
    });

    recentHits.push(now);
    registerRateMap.set(clientIp, recentHits);

    res.status(201).json({
      ok: true,
      player: formatPlayerDoc(createdDoc.toObject())
    });
  } catch (err) {
    console.error('[Casino Web Register Error]:', err);
    res.status(500).json({ ok: false, error: 'ไม่สามารถสร้างบัญชีได้ในขณะนี้ กรุณาลองใหม่ค่ะ' });
  }
});

// ==========================================
// 🔐 3. ตั้งรหัส PIN 4 หลักใหม่ (POST /api/casino/set-pin)
// ==========================================
router.post('/set-pin', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const { userId, pin, confirmPin } = req.body || {};
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'ไม่พบรหัสผู้ใช้ค่ะ' });
    }

    const existingDoc = await User.findOne({ discordId: userId }).lean();
    if (!existingDoc) {
      return res.status(404).json({ ok: false, error: 'ไม่พบบัญชีสมาชิกนี้ในฐานข้อมูลค่ะ' });
    }
    if (isBotAccount(existingDoc, userId)) {
      return res.status(403).json({ ok: false, error: 'น้องคอร์นจ๊อบเป็นบอทปลุกเว็บอัตโนมัติ ห้ามตั้งรหัสแทนนะคะ 🤖' });
    }

    const cleanPin = String(pin || '').trim();
    if (!/^\d{4}$/.test(cleanPin) || cleanPin !== String(confirmPin || '').trim()) {
      return res.status(400).json({ ok: false, error: 'รหัสผ่านตัวเลข 4 หลักไม่ถูกต้องหรือไม่ตรงกันค่ะ' });
    }

    if (existingDoc.casinoPin && /^\d{4}$/.test(String(existingDoc.casinoPin).trim())) {
      return res.status(409).json({ ok: false, error: 'บัญชีนี้ตั้งรหัสผ่าน 4 หลักไว้แล้วค่ะ!' });
    }

    await User.findOneAndUpdate({ discordId: userId }, { $set: { casinoPin: cleanPin } });
    tryAssignDiscordPinRole(userId);

    res.status(200).json({ ok: true, userId, hasPin: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'เกิดข้อผิดพลาดในการบันทึกรหัสค่ะ' });
  }
});

// ==========================================
// 🔑 4. ตรวจสอบรหัส PIN 4 หลัก (POST /api/casino/verify-pin)
// ==========================================
router.post('/verify-pin', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const { userId, pin } = req.body || {};
    if (!userId || !pin) return res.status(400).json({ ok: false, valid: false });
    if (String(userId).startsWith('bot_')) return res.status(403).json({ ok: false, valid: false });

    const now = Date.now();
    if (now - (pinVerifyAttemptMap.get(userId) || 0) < 400) {
      return res.status(429).json({ ok: false, valid: false });
    }
    pinVerifyAttemptMap.set(userId, now);

    const cleanPin = String(pin).trim();
    if (!/^\d{4}$/.test(cleanPin)) return res.status(200).json({ ok: true, valid: false });

    const userDoc = await User.findOne({ discordId: userId }).select('casinoPin accountType').lean();
    if (isBotAccount(userDoc, userId)) return res.status(403).json({ ok: false, valid: false });

    const isValid = Boolean(userDoc?.casinoPin && String(userDoc.casinoPin).trim() === cleanPin);
    res.status(200).json({ ok: true, valid: isValid });
  } catch (err) {
    res.status(500).json({ ok: false, valid: false, error: err.message });
  }
});

// ==========================================
// 🏦 5. ธนาคาร: ฝากเงินเข้าธนาคาร (POST /api/casino/bank/deposit)
// ==========================================
router.post('/bank/deposit', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const { userId, pin, amount } = req.body || {};
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการค่ะ' });
    }

    const userDoc = await User.findOne({ discordId: userId }).lean();
    if (!userDoc) return res.status(404).json({ ok: false, error: 'ไม่พบบัญชีสมาชิกนี้ค่ะ' });
    if (isBotAccount(userDoc, userId)) {
      return res.status(403).json({ ok: false, error: 'ไม่สามารถทำรายการแทนบัญชีบอทได้ค่ะ 🤖' });
    }
    if (!isPinAuthorized(userDoc, pin)) {
      return res.status(403).json({ ok: false, error: 'รหัสผ่าน 4 หลักไม่ถูกต้อง กรุณายืนยันตัวตนใหม่ค่ะ 🔒' });
    }

    const calc = calculateDeposit(userDoc.walletBalance, userDoc.bankBalance, amount);
    if (!calc.ok) return res.status(400).json({ ok: false, error: calc.error });

    const updated = await User.findOneAndUpdate(
      { discordId: userId },
      {
        $set: { walletBalance: calc.newWallet, bankBalance: calc.newBank },
        $push: { transactions: { $each: [calc.tx], $slice: -MAX_STATEMENT_ITEMS } }
      },
      { new: true }
    ).lean();

    res.status(200).json({
      ok: true,
      userId,
      walletBalance: updated.walletBalance,
      bankBalance: clampBank(updated.bankBalance),
      fee: calc.fee,
      credited: calc.credited,
      transactions: [...(updated.transactions || [])].reverse()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'ไม่สามารถฝากเงินได้ในขณะนี้ค่ะ' });
  }
});

// ==========================================
// 🏧 6. ธนาคาร: ถอนเงินเข้ากระเป๋า (POST /api/casino/bank/withdraw)
// ==========================================
router.post('/bank/withdraw', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const { userId, pin, amount } = req.body || {};
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการค่ะ' });
    }

    const userDoc = await User.findOne({ discordId: userId }).lean();
    if (!userDoc) return res.status(404).json({ ok: false, error: 'ไม่พบบัญชีสมาชิกนี้ค่ะ' });
    if (isBotAccount(userDoc, userId)) {
      return res.status(403).json({ ok: false, error: 'ไม่สามารถทำรายการแทนบัญชีบอทได้ค่ะ 🤖' });
    }
    if (!isPinAuthorized(userDoc, pin)) {
      return res.status(403).json({ ok: false, error: 'รหัสผ่าน 4 หลักไม่ถูกต้อง กรุณายืนยันตัวตนใหม่ค่ะ 🔒' });
    }

    const calc = calculateWithdraw(userDoc.walletBalance, userDoc.bankBalance, amount);
    if (!calc.ok) return res.status(400).json({ ok: false, error: calc.error });

    const updated = await User.findOneAndUpdate(
      { discordId: userId },
      {
        $set: { walletBalance: calc.newWallet, bankBalance: calc.newBank },
        $push: { transactions: { $each: [calc.tx], $slice: -MAX_STATEMENT_ITEMS } }
      },
      { new: true }
    ).lean();

    res.status(200).json({
      ok: true,
      userId,
      walletBalance: updated.walletBalance,
      bankBalance: clampBank(updated.bankBalance),
      withdrawn: calc.amount,
      transactions: [...(updated.transactions || [])].reverse()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'ไม่สามารถถอนเงินได้ในขณะนี้ค่ะ' });
  }
});

// ==========================================
// 📜 7. ตรวจสอบการเดินบัญชีล่าสุด 10 รายการ (GET /api/casino/transactions/:userId)
// ==========================================
router.get('/transactions/:userId', async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId) return res.status(400).json({ ok: false, error: 'ไม่พบรหัสผู้ใช้ค่ะ' });

    const userDoc = await User.findOne({ discordId: userId })
      .select('walletBalance bankBalance transactions')
      .lean();
    if (!userDoc) return res.status(404).json({ ok: false, error: 'ไม่พบบัญชีสมาชิกนี้ค่ะ' });

    const list = Array.isArray(userDoc.transactions) ? [...userDoc.transactions].reverse() : [];
    res.status(200).json({
      ok: true,
      userId,
      walletBalance: Number(userDoc.walletBalance || 0),
      bankBalance: clampBank(userDoc.bankBalance || 0),
      transactions: list.slice(0, MAX_STATEMENT_ITEMS)
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'ไม่สามารถโหลดรายการเดินบัญชีได้ค่ะ' });
  }
});

// ==========================================
// 🎰 8. ปั่นสล็อต 3 ช่องสำหรับผู้เล่นทั่วไป (POST /api/casino/spin)
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
    if (isBotAccount(existingDoc, userId)) {
      return res.status(403).json({ ok: false, error: 'น้องคอร์นจ๊อบจะโยกสล็อตเองอัตโนมัติทุกครั้งที่มาปลุกเว็บค่ะ 🤖' });
    }
    if (!isPinAuthorized(existingDoc, pin)) {
      return res.status(403).json({ ok: false, error: 'รหัสผ่าน 4 หลักไม่ถูกต้อง กรุณายืนยันตัวตนใหม่ค่ะ 🔒' });
    }

    spinCooldownMap.set(userId, now);

    const payload = await executeSlotSpin({ userId, existingDoc, isBot: false });
    res.status(200).json(payload);
  } catch (err) {
    console.error('[Casino Spin Error]:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;