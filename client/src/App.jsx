import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { casinoApi } from './api';
import { fireOutcomeEffect, fireStampUnlockBurst } from './utils/celebrationEffects';
import CafeParticles from './components/CafeParticles.jsx';
import AuthModal from './components/AuthModal.jsx';
import SlotMachine from './components/SlotMachine.jsx';
import EventDisplay from './components/EventDisplay.jsx';
import StampBookModal from './components/StampBookModal.jsx';

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
const DEFAULT_LANDMARKS = [
  { id: 'GARDEN', icon: '🪴', name: 'สวนต้นไม้พืชพรรณ', owned: false },
  { id: 'SAKURA', icon: '🌸', name: 'ต้นซากุระ', owned: false },
  { id: 'MEADOW', icon: '🪻', name: 'ทุ่งดอกไม้', owned: false },
  { id: 'BEACH', icon: '🏖️', name: 'ชายหาด', owned: false },
  { id: 'RIVER', icon: '🏞️', name: 'แม่น้ำภูเขา', owned: false }
];

function getStatusPill(balance, isTopSultan) {
  const bal = Number(balance || 0);
  if (isTopSultan && bal > 0) return { cls: 'sultan', text: '👑 สุลต่านคาเฟ่' };
  if (bal < 0) return { cls: 'debt', text: '💸 เป็นหนี้' };
  if (bal === 0) return { cls: 'broke', text: '🪙 หมดตัว' };
  return { cls: 'normal', text: '💰 มีเงินติดกระเป๋า' };
}

export default function App() {
  const [players, setPlayers] = useState([]);
  const [landmarks, setLandmarks] = useState(DEFAULT_LANDMARKS);
  const [tipJar, setTipJar] = useState(500);
  const [stampCatalog, setStampCatalog] = useState({ totalStamps: 158, categories: [], stamps: [] });
  const [loadingInit, setLoadingInit] = useState(true);

  const [activePlayer, setActivePlayer] = useState(null);
  const [verifiedPin, setVerifiedPin] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(true);
  const [stampModalState, setStampModalState] = useState({ open: false, category: 'ALL' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // เฟสสล็อต: IDLE -> SPINNING -> MENU_SHOW (รอแตะพลิกทีละใบ) -> REVEALED
  const [spinPhase, setSpinPhase] = useState('IDLE');
  const [spinProgress, setSpinProgress] = useState(0);
  const [menuRevealedCount, setMenuRevealedCount] = useState(0);
  const [flippedSlots, setFlippedSlots] = useState([false, false, false]);
  const [spinResult, setSpinResult] = useState(null);
  const [isBrandNewStamp, setIsBrandNewStamp] = useState(false);
  const [spinError, setSpinError] = useState('');
  const [floatingDelta, setFloatingDelta] = useState(null);

  const timersRef = useRef([]);
  const revealDoneRef = useRef(false);
  const pendingPayloadRef = useRef(null);

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
      if (data.stampCatalog) setStampCatalog(data.stampCatalog);
    }
  }, []);

  useEffect(() => {
    loadCasinoData();
    return () => clearTimers();
  }, [loadCasinoData, clearTimers]);

  const maxWallet = useMemo(
    () => Math.max(0, ...players.map((p) => Number(p.walletBalance || 0))),
    [players]
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

  const handleAuthenticated = (player, pin) => {
    clearTimers();
    revealDoneRef.current = false;
    pendingPayloadRef.current = null;
    setActivePlayer(player);
    setVerifiedPin(pin);
    setAuthModalOpen(false);
    setDrawerOpen(false);
    setSpinPhase('IDLE');
    setSpinProgress(0);
    setMenuRevealedCount(0);
    setFlippedSlots([false, false, false]);
    setSpinResult(null);
    setSpinError('');
    setFloatingDelta(null);

    setPlayers((prev) => {
      const exists = prev.some((p) => p.userId === player.userId);
      const updated = exists
        ? prev.map((p) => (p.userId === player.userId ? { ...p, ...player, hasPin: true } : p))
        : [...prev, { ...player, hasPin: true }];
      return updated.sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
    });
  };

  // เฉลยผลลัพธ์เต็มรูปแบบทันทีเมื่อผู้เล่นแตะพลิกครบทั้ง 3 ใบ
  const finalizeOutcomeReveal = useCallback((res, brandNew) => {
    if (!res || revealDoneRef.current) return;
    revealDoneRef.current = true;

    setSpinPhase('REVEALED');

    setActivePlayer((curr) =>
      curr
        ? {
            ...curr,
            walletBalance: res.newBalance,
            scratchCount: res.scratchCount,
            collectedStamps: res.collectedStamps || curr.collectedStamps
          }
        : curr
    );

    const delta = Number(res.outcome?.delta || 0);
    if (delta !== 0) {
      setFloatingDelta({ id: Date.now(), value: delta });
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

    const friendMap = new Map((res.affectedFriends || []).map((f) => [f.userId, f.newBalance]));
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.userId === res.userId) {
          return {
            ...p,
            walletBalance: res.newBalance,
            scratchCount: res.scratchCount,
            collectedStamps: res.collectedStamps || p.collectedStamps
          };
        }
        if (friendMap.has(p.userId)) {
          return { ...p, walletBalance: friendMap.get(p.userId) };
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
  }, []);

  // แตะการ์ดทีละใบเพื่อพลิกเปิดชะตา
  const handleFlipCard = useCallback(
    (idx) => {
      if (spinPhase !== 'MENU_SHOW') return;
      setFlippedSlots((prev) => {
        if (prev[idx]) return prev;
        const next = [...prev];
        next[idx] = true;

        if (next.every(Boolean) && pendingPayloadRef.current && !revealDoneRef.current) {
          const { res, brandNew } = pendingPayloadRef.current;
          // หน่วงให้แอนิเมชันพลิกใบสุดท้ายจบสวยๆ แล้วค่อยเฉลยรายละเอียด + เงิน + พลุ
          timersRef.current.push(setTimeout(() => finalizeOutcomeReveal(res, brandNew), 300));
        }
        return next;
      });
    },
    [spinPhase, finalizeOutcomeReveal]
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
    setDrawerOpen(false);

    setSpinError('');
    setIsBrandNewStamp(false);
    setFloatingDelta(null);
    setSpinPhase('SPINNING');
    setSpinProgress(18);
    setMenuRevealedCount(0);
    setFlippedSlots([false, false, false]);

    const prevStamps = new Set(activePlayer.collectedStamps || []);
    const spinStartedAt = Date.now();
    const res = await casinoApi.spin(activePlayer.userId, verifiedPin);

    if (!res.ok) {
      setSpinPhase('IDLE');
      setSpinProgress(0);
      setSpinError(res.error || 'ไม่สามารถหมุนสล็อตได้ในขณะนี้ค่ะ');
      return;
    }

    const brandNew = Boolean(res.unlockedStampId && !prevStamps.has(res.unlockedStampId));
    pendingPayloadRef.current = { res, brandNew };
    setSpinResult(res);
    setIsBrandNewStamp(brandNew);
    setSpinProgress(36);

    // หยุดวงล้อเผยเมนูทีละช่องพร้อมโปรเกรสบาร์ (ช่อง 1 -> ช่อง 2 -> ช่อง 3)
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
        setSpinPhase('MENU_SHOW');
      }, stop3Delay)
    );
  };

  const statusPill = activePlayer
    ? getStatusPill(activePlayer.walletBalance, activePlayer.walletBalance > 0 && activePlayer.walletBalance >= maxWallet)
    : null;

  return (
    <>
      <CafeParticles mood={particleMood} landmarks={landmarks} />

      <div className="cafe-app">
        {/* แถบบนมินิบางเฉียบ: แสดงโปรไฟล์ย่อ + กระเป๋าตังค์ + ปุ่มเปิดลิ้นชักลอย */}
        <header className="mini-top-bar">
          <button
            type="button"
            className="mini-brand-btn"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
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
              <div className="wallet-pill wallet-pill-compact wallet-pill-anchor">
                <span className={`wallet-value ${activePlayer.walletBalance < 0 ? 'negative' : ''}`}>
                  <NumberFlow value={Number(activePlayer.walletBalance || 0)} /> 🪙
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
              </div>
            )}

            <button
              type="button"
              className={`drawer-toggle-btn ${drawerOpen ? 'open' : ''}`}
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="เปิดหรือซ่อนลิ้นชักเมนูคาเฟ่"
            >
              <span>{drawerOpen ? '▲ ซ่อน' : '▼ เมนู'}</span>
            </button>
          </div>
        </header>

        {/* ลิ้นชักลอยด้านบน (ซ่อนข้อมูลเสริมที่ไม่เกี่ยวกับตัวตู้สล็อต) */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                className="drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                className="floating-top-drawer"
                initial={{ opacity: 0, y: -18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.98 }}
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
                      onClick={() => setDrawerOpen(false)}
                    >
                      ✕ พับเก็บ
                    </button>
                  </div>

                  {activePlayer && (
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
                          <span className={`account-type-tag ${activePlayer.accountType === 'web' ? 'web' : 'discord'}`}>
                            {activePlayer.accountType === 'web' ? '🌐 เว็บ' : '💬 Discord'}
                          </span>
                        </div>
                        <div className="player-sub-row">
                          {statusPill && <span className={`status-pill ${statusPill.cls}`}>{statusPill.text}</span>}
                          <span>• ปั่นแล้ว {Number(activePlayer.scratchCount || 0).toLocaleString()} รอบ</span>
                        </div>
                      </div>
                      <div className="tipjar-pill" title="กระปุกหมูสะสมจากคนที่โดนหักเงินในร้าน">
                        🐷 <NumberFlow value={Number(tipJar || 0)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* แลนด์มาร์กริมหน้าต่าง 5 โซน */}
                <div className="drawer-section">
                  <div className="drawer-label">🏰 แลนด์มาร์กริมหน้าต่างคาเฟ่ 5 โซน</div>
                  <div className="drawer-landmarks-grid">
                    {landmarks.map((lm) => (
                      <div key={lm.id} className={`drawer-lm-item ${lm.owned ? 'owned' : 'empty'}`}>
                        <span className="drawer-lm-icon">{lm.icon}</span>
                        <div className="drawer-lm-info">
                          <strong>{lm.name}</strong>
                          <span>
                            {lm.owned
                              ? `${lm.ownerName} • ขั้น ${lm.tier} (${lm.pct}%)${lm.curtainClosed ? ' • ปิดม่าน' : ''}`
                              : 'ว่าง • ยังไม่มีผู้ถือครอง'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ปุ่มเครื่องมือทั้งหมด */}
                <div className="drawer-actions">
                  <button
                    type="button"
                    className="btn-pill btn-stamp"
                    onClick={() => {
                      setDrawerOpen(false);
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
                    onClick={() => setSoundEnabled((v) => !v)}
                  >
                    {soundEnabled ? '🔊 เสียงเปิด' : '🔇 ปิดเสียง'}
                  </button>

                  <button
                    type="button"
                    className="btn-pill"
                    onClick={() => {
                      setDrawerOpen(false);
                      setAuthModalOpen(true);
                    }}
                    disabled={isBusy}
                  >
                    👤 เปลี่ยนผู้เล่น
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* เวทีหลักเต็มจอ: ตู้สล็อต + คันโยกด้านข้าง + กล่องรายละเอียดอีเวนท์ */}
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