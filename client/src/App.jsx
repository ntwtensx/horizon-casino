import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { motion, AnimatePresence } from 'framer-motion';
import './styles/bank.css';
import { casinoApi } from './api';
import { fireOutcomeEffect, fireStampUnlockBurst } from './utils/celebrationEffects';
import CafeParticles from './components/CafeParticles.jsx';
import AuthModal from './components/AuthModal.jsx';
import SlotMachine from './components/SlotMachine.jsx';
import EventDisplay from './components/EventDisplay.jsx';
import StampBookModal from './components/StampBookModal.jsx';
import BankModal from './components/BankModal.jsx';

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
const DEFAULT_LANDMARKS = [
  { id: 'GARDEN', icon: '🪴', name: 'สวนต้นไม้พืชพรรณ', owned: false },
  { id: 'SAKURA', icon: '🌸', name: 'ต้นซากุระ', owned: false },
  { id: 'MEADOW', icon: '🪻', name: 'ทุ่งดอกไม้', owned: false },
  { id: 'BEACH', icon: '🏖️', name: 'ชายหาด', owned: false },
  { id: 'RIVER', icon: '🏞️', name: 'แม่น้ำภูเขา', owned: false }
];

function getStatusPill(walletBalance, bankBalance, isTopSultan) {
  const wallet = Number(walletBalance || 0);
  const bank = Math.max(0, Number(bankBalance || 0));
  if (isTopSultan && wallet + bank > 0) return { cls: 'sultan', text: '👑 สุลต่านคาเฟ่' };
  if (wallet < 0) return { cls: 'debt', text: '💸 เป็นหนี้' };
  if (wallet === 0 && bank === 0) return { cls: 'broke', text: '🪙 หมดตัว' };
  if (wallet === 0 && bank > 0) return { cls: 'normal', text: '🏦 เก็บไว้ในธนาคาร' };
  return { cls: 'normal', text: '💰 มีเงินติดกระเป๋า' };
}

export default function App() {
  const [players, setPlayers] = useState([]);
  const [landmarks, setLandmarks] = useState(DEFAULT_LANDMARKS);
  const [tipJar, setTipJar] = useState(500);
  const [depositFeePct, setDepositFeePct] = useState(3);
  const [stampCatalog, setStampCatalog] = useState({ totalStamps: 158, categories: [], stamps: [] });
  const [loadingInit, setLoadingInit] = useState(true);

  const [activePlayer, setActivePlayer] = useState(null);
  const [verifiedPin, setVerifiedPin] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(true);
  const [stampModalState, setStampModalState] = useState({ open: false, category: 'ALL' });
  const [bankModalState, setBankModalState] = useState({ open: false, tab: 'BANK' });

  // ลิ้นชักลอยด้านบน: 'NONE' | 'LANDMARKS' | 'MENU'
  const [activeDrawer, setActiveDrawer] = useState('NONE');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // เฟสสล็อต: IDLE -> SPINNING -> MENU_SHOW -> REVEALED
  const [spinPhase, setSpinPhase] = useState('IDLE');
  const [spinProgress, setSpinProgress] = useState(0);
  const [menuRevealedCount, setMenuRevealedCount] = useState(0);
  const [flippedSlots, setFlippedSlots] = useState([false, false, false]);
  const [spinResult, setSpinResult] = useState(null);
  const [isBrandNewStamp, setIsBrandNewStamp] = useState(false);
  const [spinError, setSpinError] = useState('');
  const [floatingDelta, setFloatingDelta] = useState(null);

  const timersRef = useRef([]);
  const spinPhaseRef = useRef('IDLE');
  const flippedRef = useRef([false, false, false]);
  const revealDoneRef = useRef(false);
  const pendingPayloadRef = useRef(null);

  const updateSpinPhase = useCallback((nextPhase) => {
    spinPhaseRef.current = nextPhase;
    setSpinPhase(nextPhase);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const loadCasinoData = useCallback(async () => {
    setLoadingInit(true);
    const data = await casinoApi.init();
    setLoadingInit(false);
    if (data.ok) {
      setPlayers(data.players || []);
      if (Array.isArray(data.landmarks) && data.landmarks.length === 5) {
        setLandmarks(data.landmarks);
      }
      if (typeof data.tipJar === 'number') setTipJar(data.tipJar);
      if (typeof data.depositFeePct === 'number') setDepositFeePct(data.depositFeePct);
      if (data.stampCatalog) setStampCatalog(data.stampCatalog);
    }
  }, []);

  useEffect(() => {
    loadCasinoData();
    return () => clearTimers();
  }, [loadCasinoData, clearTimers]);

  // คำนวณยอดสุทธิสูงสุด (กระเป๋า + ธนาคาร) สำหรับตำแหน่งสุลต่าน
  const maxNetWorth = useMemo(
    () =>
      Math.max(
        0,
        ...players.map((p) => Number(p.walletBalance || 0) + Math.max(0, Number(p.bankBalance || 0)))
      ),
    [players]
  );

  const ownedLandmarksCount = useMemo(
    () => landmarks.filter((lm) => Boolean(lm.owned)).length,
    [landmarks]
  );

  const ownedStampCount = useMemo(() => {
    const owned = new Set(activePlayer?.collectedStamps || []);
    return (stampCatalog.stamps || []).filter((s) => owned.has(s.id)).length;
  }, [activePlayer, stampCatalog]);

  const matchedStamp = useMemo(() => {
    const id = spinResult?.unlockedStampId;
    if (!id) return null;
    return (stampCatalog.stamps || []).find((s) => s.id === id) || null;
  }, [spinResult, stampCatalog]);

  const particleMood = useMemo(() => {
    if (spinPhase === 'SPINNING') return 'spinning';
    const t = spinResult?.outcome?.outcomeType;
    if (spinPhase !== 'REVEALED' || !t) return 'idle';
    if (t === 'MIRACLE') return 'miracle';
    if (t === 'JACKPOT' || t === 'WIN') return 'win';
    if (['DIVIDER', 'TAX', 'THEFT'].includes(t)) return 'bad';
    return 'idle';
  }, [spinPhase, spinResult]);

  const isBusy = spinPhase === 'SPINNING' || spinPhase === 'MENU_SHOW';

  const toggleDrawer = (target) => {
    setActiveDrawer((curr) => (curr === target ? 'NONE' : target));
  };

  const openBankModal = (tab = 'BANK') => {
    if (!activePlayer || isBusy) return;
    setActiveDrawer('NONE');
    setBankModalState({ open: true, tab });
  };

  // ซิงค์ยอดกระเป๋าและธนาคารหลังฝาก/ถอน/รีเฟรชเดินบัญชี (stable callback)
  const handleBalancesUpdated = useCallback((userId, walletBalance, bankBalance) => {
    setActivePlayer((curr) =>
      curr && curr.userId === userId
        ? { ...curr, walletBalance, bankBalance }
        : curr
    );
    setPlayers((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, walletBalance, bankBalance } : p))
    );
  }, []);

  const handleAuthenticated = (player, pin) => {
    clearTimers();
    revealDoneRef.current = false;
    pendingPayloadRef.current = null;
    flippedRef.current = [false, false, false];

    const normalizedPlayer = {
      ...player,
      bankBalance: Math.max(0, Number(player.bankBalance || 0))
    };

    setActivePlayer(normalizedPlayer);
    setVerifiedPin(pin);
    setAuthModalOpen(false);
    setActiveDrawer('NONE');
    setBankModalState({ open: false, tab: 'BANK' });
    updateSpinPhase('IDLE');
    setSpinProgress(0);
    setMenuRevealedCount(0);
    setFlippedSlots([false, false, false]);
    setSpinResult(null);
    setSpinError('');
    setFloatingDelta(null);

    setPlayers((prev) => {
      const exists = prev.some((p) => p.userId === normalizedPlayer.userId);
      const updated = exists
        ? prev.map((p) =>
            p.userId === normalizedPlayer.userId ? { ...p, ...normalizedPlayer, hasPin: true } : p
          )
        : [...prev, { ...normalizedPlayer, hasPin: true }];
      return updated.sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
    });
  };

  const finalizeOutcomeReveal = useCallback(
    (res, brandNew) => {
      if (!res || revealDoneRef.current) return;
      revealDoneRef.current = true;
      updateSpinPhase('REVEALED');

      setActivePlayer((curr) =>
        curr
          ? {
              ...curr,
              walletBalance: res.newBalance,
              bankBalance:
                typeof res.newBankBalance === 'number' ? res.newBankBalance : curr.bankBalance || 0,
              scratchCount: res.scratchCount,
              collectedStamps: res.collectedStamps || curr.collectedStamps
            }
          : curr
      );

      const combinedDelta =
        (typeof res.walletDelta === 'number' ? res.walletDelta : Number(res.outcome?.delta || 0)) +
        (typeof res.bankDelta === 'number' ? res.bankDelta : 0);

      if (combinedDelta !== 0) {
        setFloatingDelta({ id: Date.now(), value: combinedDelta });
        timersRef.current.push(setTimeout(() => setFloatingDelta(null), 1900));
      }

      fireOutcomeEffect(
        res.outcome?.outcomeType,
        brandNew,
        res.outcome?.slots?.[0]?.icon || ''
      );
      if (brandNew) {
        timersRef.current.push(setTimeout(() => fireStampUnlockBurst(), 340));
      }

      const friendMap = new Map(
        (res.affectedFriends || []).map((f) => [
          f.userId,
          { walletBalance: f.newBalance, bankBalance: f.newBankBalance }
        ])
      );

      setPlayers((prev) =>
        prev.map((p) => {
          if (p.userId === res.userId) {
            return {
              ...p,
              walletBalance: res.newBalance,
              bankBalance:
                typeof res.newBankBalance === 'number' ? res.newBankBalance : p.bankBalance || 0,
              scratchCount: res.scratchCount,
              collectedStamps: res.collectedStamps || p.collectedStamps
            };
          }
          if (friendMap.has(p.userId)) {
            const fm = friendMap.get(p.userId);
            return {
              ...p,
              walletBalance: fm.walletBalance,
              bankBalance: typeof fm.bankBalance === 'number' ? fm.bankBalance : p.bankBalance || 0
            };
          }
          return p;
        })
      );

      if (Array.isArray(res.landmarks) && res.landmarks.length === 5) {
        setLandmarks(res.landmarks);
      }
      if (typeof res.tipJar === 'number') {
        setTipJar(res.tipJar);
      }
    },
    [updateSpinPhase]
  );

  const handleFlipCard = useCallback(
    (idx) => {
      if (spinPhaseRef.current !== 'MENU_SHOW') return;
      if (idx < 0 || idx > 2 || flippedRef.current[idx]) return;

      const next = [...flippedRef.current];
      next[idx] = true;
      flippedRef.current = next;
      setFlippedSlots(next);

      if (next.every(Boolean) && pendingPayloadRef.current && !revealDoneRef.current) {
        const { res, brandNew } = pendingPayloadRef.current;
        timersRef.current.push(setTimeout(() => finalizeOutcomeReveal(res, brandNew), 380));
      }
    },
    [finalizeOutcomeReveal]
  );

  const handlePullLever = async () => {
    if (!activePlayer) {
      setAuthModalOpen(true);
      return;
    }
    if (isBusy) return;

    clearTimers();
    revealDoneRef.current = false;
    pendingPayloadRef.current = null;
    flippedRef.current = [false, false, false];
    setActiveDrawer('NONE');

    setSpinError('');
    setIsBrandNewStamp(false);
    setFloatingDelta(null);
    updateSpinPhase('SPINNING');
    setSpinProgress(18);
    setMenuRevealedCount(0);
    setFlippedSlots([false, false, false]);

    const prevStamps = new Set(activePlayer.collectedStamps || []);
    const spinStartedAt = Date.now();
    const res = await casinoApi.spin(activePlayer.userId, verifiedPin);

    if (!res.ok) {
      updateSpinPhase('IDLE');
      setSpinProgress(0);
      setSpinError(res.error || 'ไม่สามารถหมุนสล็อตได้ในขณะนี้ค่ะ');
      return;
    }

    const brandNew = Boolean(res.unlockedStampId && !prevStamps.has(res.unlockedStampId));
    pendingPayloadRef.current = { res, brandNew };
    setSpinResult(res);
    setIsBrandNewStamp(brandNew);
    setSpinProgress(36);

    const elapsed = Date.now() - spinStartedAt;
    const stop1Delay = Math.max(240, 820 - elapsed);
    const stop2Delay = stop1Delay + 580;
    const stop3Delay = stop2Delay + 680;

    timersRef.current.push(
      setTimeout(() => {
        setMenuRevealedCount(1);
        setSpinProgress(62);
      }, stop1Delay)
    );
    timersRef.current.push(
      setTimeout(() => {
        setMenuRevealedCount(2);
        setSpinProgress(84);
      }, stop2Delay)
    );
    timersRef.current.push(
      setTimeout(() => {
        setMenuRevealedCount(3);
        setSpinProgress(100);
        updateSpinPhase('MENU_SHOW');
      }, stop3Delay)
    );
  };

  const activeNetWorth = activePlayer
    ? Number(activePlayer.walletBalance || 0) + Math.max(0, Number(activePlayer.bankBalance || 0))
    : 0;

  const statusPill = activePlayer
    ? getStatusPill(
        activePlayer.walletBalance,
        activePlayer.bankBalance,
        activeNetWorth > 0 && activeNetWorth >= maxNetWorth
      )
    : null;

  return (
    <>
      <CafeParticles mood={particleMood} landmarks={landmarks} />

      <div className="cafe-app">
        {/* แถบบนมินิ: โปรไฟล์ย่อ + ปุ่มกระเป๋าตังค์(แตะเปิดธนาคาร) + ลิ้นชักแลนด์มาร์ก + ลิ้นชักเมนู */}
        <header className="mini-top-bar">
          <button
            type="button"
            className="mini-brand-btn"
            onClick={() => toggleDrawer('MENU')}
            aria-expanded={activeDrawer === 'MENU'}
          >
            {activePlayer ? (
              <img
                className="mini-avatar"
                src={activePlayer.avatar || DEFAULT_AVATAR}
                alt={activePlayer.displayName}
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
            ) : (
              <span className="mini-brand-emoji">☕</span>
            )}
            <div className="mini-brand-text">
              <span className="mini-name">
                {activePlayer
                  ? activePlayer.nickname
                    ? `คุณ${activePlayer.nickname}`
                    : activePlayer.displayName
                  : 'Horizon Casino'}
              </span>
              <span className="mini-sub">☕ Horizon Slot</span>
            </div>
          </button>

          <div className="mini-right-group">
            {activePlayer && (
              <button
                type="button"
                className="wallet-pill wallet-pill-btn wallet-pill-anchor"
                onClick={() => openBankModal('BANK')}
                disabled={isBusy}
                title="คลิกเพื่อเปิดธนาคารฝาก-ถอน และตรวจสอบการเดินบัญชี"
              >
                <span className={`wallet-value ${activePlayer.walletBalance < 0 ? 'negative' : ''}`}>
                  <NumberFlow value={Number(activePlayer.walletBalance || 0)} /> 🪙
                </span>
                <span className="wallet-bank-dot" aria-hidden="true">
                  🏦
                </span>

                <AnimatePresence>
                  {floatingDelta && (
                    <motion.span
                      key={floatingDelta.id}
                      className={`wallet-delta-float ${floatingDelta.value > 0 ? 'pos' : 'neg'}`}
                      initial={{ opacity: 0, y: 6, scale: 0.75 }}
                      animate={{ opacity: 1, y: 30, scale: 1.05 }}
                      exit={{ opacity: 0, y: 44, scale: 0.9 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                    >
                      {floatingDelta.value > 0
                        ? `+${floatingDelta.value.toLocaleString()} 🪙`
                        : `${floatingDelta.value.toLocaleString()} 💸`}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}

            <button
              type="button"
              className={`landmark-drawer-btn ${ownedLandmarksCount > 0 ? 'has-owned' : ''} ${
                activeDrawer === 'LANDMARKS' ? 'open' : ''
              }`}
              onClick={() => toggleDrawer('LANDMARKS')}
              aria-expanded={activeDrawer === 'LANDMARKS'}
              title="ดูรายการผู้ถือหุ้นแลนด์มาร์กริมหน้าต่าง 5 โซน"
            >
              <span>🏰</span>
              <span className="lm-btn-count">{ownedLandmarksCount}/5</span>
            </button>

            <button
              type="button"
              className={`drawer-toggle-btn ${activeDrawer === 'MENU' ? 'open' : ''}`}
              onClick={() => toggleDrawer('MENU')}
              aria-expanded={activeDrawer === 'MENU'}
              aria-label="เปิดหรือซ่อนลิ้นชักเมนู"
            >
              <span>{activeDrawer === 'MENU' ? '▲' : '▼ เมนู'}</span>
            </button>
          </div>
        </header>

        <AnimatePresence>
          {activeDrawer !== 'NONE' && (
            <motion.div
              className="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawer('NONE')}
            />
          )}
        </AnimatePresence>

        {/* ลิ้นชักลอย 1: 🏰 แลนด์มาร์กริมหน้าต่าง 5 โซน */}
        <AnimatePresence>
          {activeDrawer === 'LANDMARKS' && (
            <div className="floating-drawer-wrap">
              <motion.aside
                className="floating-top-drawer"
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              >
                <div className="drawer-row-between">
                  <div className="brand-title">
                    <span>🏰 แลนด์มาร์กริมหน้าต่าง</span>
                    <span className="brand-badge">ถือครอง {ownedLandmarksCount}/5 โซน</span>
                  </div>
                  <button
                    type="button"
                    className="drawer-close-pill"
                    onClick={() => setActiveDrawer('NONE')}
                  >
                    ✕ พับเก็บ
                  </button>
                </div>

                <div className="landmark-rows-list">
                  {landmarks.map((lm) => (
                    <div key={lm.id} className={`landmark-row-card ${lm.owned ? 'owned' : 'empty'}`}>
                      <div className="landmark-row-icon">{lm.icon}</div>
                      <div className="landmark-row-body">
                        <div className="landmark-row-head">
                          <span className="landmark-row-name">{lm.name}</span>
                          <span className={`landmark-tier-pill ${lm.owned ? 'owned' : 'empty'}`}>
                            {lm.owned ? `ขั้น ${lm.tier} • ${lm.pct}%` : 'ว่าง • 0%'}
                          </span>
                        </div>
                        <div className="landmark-row-owner">
                          {lm.owned ? (
                            <>
                              <span>
                                ผู้ถือหุ้น: <strong>{lm.ownerName}</strong>
                              </span>
                              {lm.curtainClosed && (
                                <span className="landmark-curtain-tag">🪟 ปิดผ้าม่านพัก 1 รอบ</span>
                              )}
                            </>
                          ) : (
                            <span>ยังไม่มีผู้ถือครอง — ปั่นสล็อตลุ้นรับสิทธิ์ขั้นที่ 1 (17%) ฟรี!</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* ลิ้นชักลอย 2: โปรไฟล์ + กระเป๋าตังค์ & ธนาคาร + สมุดแสตมป์ + ตั้งค่า */}
        <AnimatePresence>
          {activeDrawer === 'MENU' && (
            <div className="floating-drawer-wrap">
              <motion.aside
                className="floating-top-drawer"
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              >
                <div className="drawer-section">
                  <div className="drawer-row-between">
                    <div className="brand-title">
                      <span>☕ Horizon Casino</span>
                      <span className="brand-badge">Cafe Slot</span>
                    </div>
                    <button
                      type="button"
                      className="drawer-close-pill"
                      onClick={() => setActiveDrawer('NONE')}
                    >
                      ✕ พับเก็บ
                    </button>
                  </div>

                  {activePlayer && (
                    <>
                      <div className="drawer-player-card">
                        <img
                          className="player-avatar"
                          src={activePlayer.avatar || DEFAULT_AVATAR}
                          alt={activePlayer.displayName}
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                        />
                        <div className="player-meta">
                          <div className="player-name-row">
                            <span>{activePlayer.displayName}</span>
                            {activePlayer.nickname && (
                              <span className="player-nick-inline">(คุณ{activePlayer.nickname})</span>
                            )}
                            <span
                              className={`account-type-tag ${
                                activePlayer.accountType === 'web' ? 'web' : 'discord'
                              }`}
                            >
                              {activePlayer.accountType === 'web' ? '🌐 เว็บ' : '💬 Discord'}
                            </span>
                          </div>
                          <div className="player-sub-row">
                            {statusPill && (
                              <span className={`status-pill ${statusPill.cls}`}>{statusPill.text}</span>
                            )}
                            <span>• ปั่นแล้ว {Number(activePlayer.scratchCount || 0).toLocaleString()} รอบ</span>
                          </div>
                        </div>
                      </div>

                      {/* สรุปยอด 2 บัญชี แตะเพื่อเข้าธนาคาร/เดินบัญชีได้ทันที */}
                      <div className="drawer-finance-strip">
                        <button
                          type="button"
                          className="drawer-finance-card"
                          onClick={() => openBankModal('BANK')}
                          disabled={isBusy}
                        >
                          <span>👛 กระเป๋าตังค์</span>
                          <strong className={activePlayer.walletBalance < 0 ? 'negative' : ''}>
                            {Number(activePlayer.walletBalance || 0).toLocaleString()} 🪙
                          </strong>
                        </button>

                        <button
                          type="button"
                          className="drawer-finance-card bank"
                          onClick={() => openBankModal('BANK')}
                          disabled={isBusy}
                        >
                          <span>🏦 เงินฝากธนาคาร</span>
                          <strong>{Number(activePlayer.bankBalance || 0).toLocaleString()} 🪙</strong>
                        </button>
                      </div>
                    </>
                  )}

                  <div className="drawer-tipjar-row">
                    <span>🐷 กระปุกหมูสะสมหน้าเคาน์เตอร์</span>
                    <strong>
                      <NumberFlow value={Number(tipJar || 0)} /> เหรียญ
                    </strong>
                  </div>
                </div>

                <div className="drawer-actions">
                  <button
                    type="button"
                    className="btn-pill"
                    onClick={() => openBankModal('BANK')}
                    disabled={!activePlayer || isBusy}
                  >
                    🏦 ฝาก / ถอนธนาคาร
                  </button>

                  <button
                    type="button"
                    className="btn-pill"
                    onClick={() => openBankModal('STATEMENT')}
                    disabled={!activePlayer || isBusy}
                  >
                    📜 เดินบัญชี (10 รายการ)
                  </button>

                  <button
                    type="button"
                    className="btn-pill btn-stamp"
                    onClick={() => {
                      setActiveDrawer('NONE');
                      setStampModalState({ open: true, category: 'ALL' });
                    }}
                  >
                    <span>📖 สมุดแสตมป์</span>
                    <span className="stamp-pill-count">
                      {ownedStampCount}/{stampCatalog.totalStamps || 158}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn-pill"
                    onClick={() => setActiveDrawer('LANDMARKS')}
                  >
                    <span>🏰 แลนด์มาร์ก ({ownedLandmarksCount}/5)</span>
                  </button>

                  <button
                    type="button"
                    className="btn-pill"
                    onClick={() => setSoundEnabled((v) => !v)}
                  >
                    {soundEnabled ? '🔊 เสียงเปิด' : '🔇 ปิดเสียง'}
                  </button>

                  <button
                    type="button"
                    className="btn-pill"
                    onClick={() => {
                      setActiveDrawer('NONE');
                      setAuthModalOpen(true);
                    }}
                    disabled={isBusy}
                  >
                    👤 เปลี่ยนผู้เล่น
                  </button>
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <main className="casino-stage">
          <SlotMachine
            spinPhase={spinPhase}
            spinProgress={spinProgress}
            menuRevealedCount={menuRevealedCount}
            flippedSlots={flippedSlots}
            cafeMenuItems={spinResult?.outcome?.cafeMenu?.items}
            slots={spinResult?.outcome?.slots}
            outcomeType={spinResult?.outcome?.outcomeType}
            soundEnabled={soundEnabled}
            disabled={!activePlayer}
            onPullLever={handlePullLever}
            onFlipCard={handleFlipCard}
          />

          <EventDisplay
            spinPhase={spinPhase}
            spinProgress={spinProgress}
            menuRevealedCount={menuRevealedCount}
            flippedSlots={flippedSlots}
            spinResult={spinResult}
            isBrandNewStamp={isBrandNewStamp}
            matchedStamp={matchedStamp}
            errorMsg={spinError}
            onOpenStampBook={(cat) => setStampModalState({ open: true, category: cat || 'ALL' })}
          />
        </main>

        <AuthModal
          isOpen={authModalOpen}
          canClose={Boolean(activePlayer)}
          loadingPlayers={loadingInit}
          players={players}
          activePlayer={activePlayer}
          onClose={() => setAuthModalOpen(false)}
          onRefreshPlayers={loadCasinoData}
          onAuthenticated={handleAuthenticated}
        />

        <BankModal
          isOpen={bankModalState.open}
          initialTab={bankModalState.tab}
          depositFeePct={depositFeePct}
          activePlayer={activePlayer}
          verifiedPin={verifiedPin}
          onClose={() => setBankModalState((s) => ({ ...s, open: false }))}
          onBalancesUpdated={handleBalancesUpdated}
        />

        <StampBookModal
          isOpen={stampModalState.open}
          onClose={() => setStampModalState((s) => ({ ...s, open: false }))}
          stampCatalog={stampCatalog}
          activePlayer={activePlayer}
          initialCategory={stampModalState.category}
        />
      </div>
    </>
  );
}