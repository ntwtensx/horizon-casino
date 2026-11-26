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

const MENU_HOLD_MS = 1500; // ค้างหน้าเมนูคาเฟ่ 1.5 วินาทีก่อนพลิกการ์ด
const FLIP_WAVE_STEP_MS = 100; // พลิกไล่เวฟทีละใบห่างกัน 0.1 วินาที

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
  const [soundEnabled, setSoundEnabled] = useState(true);

  // เฟสสล็อต 2 จังหวะ: IDLE -> SPINNING -> MENU_SHOW -> FLIPPING -> REVEALED
  const [spinPhase, setSpinPhase] = useState('IDLE');
  const [menuRevealedCount, setMenuRevealedCount] = useState(0);
  const [flippedCount, setFlippedCount] = useState(0);
  const [spinResult, setSpinResult] = useState(null);
  const [isBrandNewStamp, setIsBrandNewStamp] = useState(false);
  const [spinError, setSpinError] = useState('');
  const [floatingDelta, setFloatingDelta] = useState(null);

  const timersRef = useRef([]);
  const flipStartedRef = useRef(false);
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
    if (spinPhase === 'SPINNING' || spinPhase === 'FLIPPING') return 'spinning';
    const t = spinResult?.outcome?.outcomeType;
    if (spinPhase !== 'REVEALED' || !t) return 'idle';
    if (t === 'MIRACLE') return 'miracle';
    if (t === 'JACKPOT' || t === 'WIN') return 'win';
    if (['DIVIDER', 'TAX', 'THEFT'].includes(t)) return 'bad';
    return 'idle';
  }, [spinPhase, spinResult]);

  const isBusy = spinPhase === 'SPINNING' || spinPhase === 'MENU_SHOW' || spinPhase === 'FLIPPING';

  const handleAuthenticated = (player, pin) => {
    clearTimers();
    flipStartedRef.current = false;
    pendingPayloadRef.current = null;
    setActivePlayer(player);
    setVerifiedPin(pin);
    setAuthModalOpen(false);
    setSpinPhase('IDLE');
    setMenuRevealedCount(0);
    setFlippedCount(0);
    setSpinResult(null);
    setSpinError('');
    setFloatingDelta(null);

    // รองรับทั้งผู้ใช้เดิมและบัญชีที่เพิ่งสมัครใหม่บนเว็บ (web_)
    setPlayers((prev) => {
      const exists = prev.some((p) => p.userId === player.userId);
      const updated = exists
        ? prev.map((p) => (p.userId === player.userId ? { ...p, ...player, hasPin: true } : p))
        : [...prev, { ...player, hasPin: true }];
      return updated.sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
    });
  };

  // เริ่มเวฟพลิกการ์ด 3D ไล่ทีละใบ (0ms -> +100ms -> +200ms) แล้วค่อยเฉลยยอดเงิน & พลุ
  const startFlipWave = useCallback(
    (res, brandNew) => {
      if (!res || flipStartedRef.current) return;
      flipStartedRef.current = true;
      clearTimers();

      setSpinPhase('FLIPPING');
      setFlippedCount(1);

      timersRef.current.push(setTimeout(() => setFlippedCount(2), FLIP_WAVE_STEP_MS));
      timersRef.current.push(setTimeout(() => setFlippedCount(3), FLIP_WAVE_STEP_MS * 2));

      // รอให้การ์ดใบที่ 3 พลิกจบแล้วค่อยอัปเดตตัวเลขและยิงเอฟเฟค
      timersRef.current.push(
        setTimeout(() => {
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
            timersRef.current.push(setTimeout(() => fireStampUnlockBurst(), 360));
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
        }, FLIP_WAVE_STEP_MS * 2 + 340)
      );
    },
    [clearTimers]
  );

  const handleQuickFlip = useCallback(() => {
    if (spinPhase !== 'MENU_SHOW' || !pendingPayloadRef.current) return;
    const { res, brandNew } = pendingPayloadRef.current;
    startFlipWave(res, brandNew);
  }, [spinPhase, startFlipWave]);

  const handlePullLever = async () => {
    if (!activePlayer) {
      setAuthModalOpen(true);
      return;
    }
    if (isBusy) return;

    clearTimers();
    flipStartedRef.current = false;
    pendingPayloadRef.current = null;

    setSpinError('');
    setIsBrandNewStamp(false);
    setFloatingDelta(null);
    setSpinPhase('SPINNING');
    setMenuRevealedCount(0);
    setFlippedCount(0);

    const prevStamps = new Set(activePlayer.collectedStamps || []);
    const spinStartedAt = Date.now();
    const res = await casinoApi.spin(activePlayer.userId, verifiedPin);

    if (!res.ok) {
      setSpinPhase('IDLE');
      setSpinError(res.error || 'ไม่สามารถหมุนสล็อตได้ในขณะนี้ค่ะ');
      return;
    }

    const brandNew = Boolean(res.unlockedStampId && !prevStamps.has(res.unlockedStampId));
    pendingPayloadRef.current = { res, brandNew };
    setSpinResult(res);
    setIsBrandNewStamp(brandNew);

    // เฟส 1: หยุดวงล้อเผยเมนูคาเฟ่ทีละช่อง (เครื่องดื่ม -> ท็อปปิ้ง -> ขนมทานเล่น)
    const elapsed = Date.now() - spinStartedAt;
    const stop1Delay = Math.max(240, 880 - elapsed);
    const stop2Delay = stop1Delay + 640;
    const stop3Delay = stop2Delay + 760;

    timersRef.current.push(setTimeout(() => setMenuRevealedCount(1), stop1Delay));
    timersRef.current.push(setTimeout(() => setMenuRevealedCount(2), stop2Delay));
    timersRef.current.push(
      setTimeout(() => {
        setMenuRevealedCount(3);
        setSpinPhase('MENU_SHOW');

        // เฟส 2: ค้างโชว์เมนู 1.5 วินาที แล้วสั่งพลิกการ์ด 3D ไล่เวฟอัตโนมัติ
        timersRef.current.push(
          setTimeout(() => {
            startFlipWave(res, brandNew);
          }, MENU_HOLD_MS)
        );
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
        <header className="cafe-hud">
          <div className="hud-top">
            <div className="hud-brand">
              <div className="brand-title">
                <span>☕ Horizon Casino</span>
                <span className="brand-badge">Cafe Slot</span>
              </div>

              <div className="landmarks-bar" aria-label="แลนด์มาร์กริมหน้าต่าง 5 โซน">
                {landmarks.map((lm) => {
                  const tip = lm.owned
                    ? `${lm.icon} ${lm.name} • ${lm.ownerName} (ขั้น ${lm.tier} : ${lm.pct}%)${
                        lm.curtainClosed ? ' • ปิดม่านพัก 1 รอบ' : ''
                      }`
                    : `${lm.icon} ${lm.name} • ยังไม่มีผู้ถือครอง`;
                  return (
                    <div key={lm.id} className={`lm-chip ${lm.owned ? 'owned' : 'empty'}`} tabIndex={0}>
                      <span>{lm.icon}</span>
                      <span className="lm-tooltip">{tip}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hud-controls">
              <button
                type="button"
                className="btn-pill btn-stamp"
                onClick={() => setStampModalState({ open: true, category: 'ALL' })}
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
                title="เปิด/ปิดเสียงสล็อต"
              >
                {soundEnabled ? '🔊 เสียงเปิด' : '🔇 ปิดเสียง'}
              </button>

              <button
                type="button"
                className="btn-pill"
                onClick={() => setAuthModalOpen(true)}
                disabled={isBusy}
              >
                👤 เปลี่ยนผู้เล่น
              </button>
            </div>
          </div>

          {activePlayer && (
            <div className="hud-player-bar">
              <div className="player-info">
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
                    <span className="player-nick">
                      {activePlayer.nickname ? `คุณ${activePlayer.nickname}` : `@${activePlayer.username}`}
                    </span>
                    <span className={`account-type-tag ${activePlayer.accountType === 'web' ? 'web' : 'discord'}`}>
                      {activePlayer.accountType === 'web' ? '🌐 เว็บ' : '💬 Discord'}
                    </span>
                  </div>
                  <div className="player-sub-row">
                    {statusPill && <span className={`status-pill ${statusPill.cls}`}>{statusPill.text}</span>}
                    <span>• ปั่นไปแล้ว {Number(activePlayer.scratchCount || 0).toLocaleString()} รอบ</span>
                  </div>
                </div>
              </div>

              <div className="hud-wallet-group">
                <div className="tipjar-pill" title="กระปุกหมูสะสมจากคนที่โดนหักเงินในร้าน">
                  🐷 กระปุกหมู: <NumberFlow value={Number(tipJar || 0)} />
                </div>

                <div className="wallet-pill wallet-pill-anchor">
                  <span className="wallet-label">👛 กระเป๋าตังค์:</span>
                  <span className={`wallet-value ${activePlayer.walletBalance < 0 ? 'negative' : ''}`}>
                    <NumberFlow value={Number(activePlayer.walletBalance || 0)} /> 🪙
                  </span>

                  <AnimatePresence>
                    {floatingDelta && (
                      <motion.span
                        key={floatingDelta.id}
                        className={`wallet-delta-float ${floatingDelta.value > 0 ? 'pos' : 'neg'}`}
                        initial={{ opacity: 0, y: 8, scale: 0.75 }}
                        animate={{ opacity: 1, y: -26, scale: 1.05 }}
                        exit={{ opacity: 0, y: -44, scale: 0.9 }}
                        transition={{ duration: 0.55, ease: 'easeOut' }}
                      >
                        {floatingDelta.value > 0
                          ? `+${floatingDelta.value.toLocaleString()} 🪙`
                          : `${floatingDelta.value.toLocaleString()} 💸`}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </header>

        <main className="casino-stage">
          <SlotMachine
            spinPhase={spinPhase}
            menuRevealedCount={menuRevealedCount}
            flippedCount={flippedCount}
            cafeMenuItems={spinResult?.outcome?.cafeMenu?.items}
            slots={spinResult?.outcome?.slots}
            outcomeType={spinResult?.outcome?.outcomeType}
            soundEnabled={soundEnabled}
            disabled={!activePlayer}
            onPullLever={handlePullLever}
            onQuickFlip={handleQuickFlip}
          />

          <EventDisplay
            spinPhase={spinPhase}
            menuRevealedCount={menuRevealedCount}
            spinResult={spinResult}
            isBrandNewStamp={isBrandNewStamp}
            matchedStamp={matchedStamp}
            errorMsg={spinError}
            onOpenStampBook={(cat) => setStampModalState({ open: true, category: cat || 'ALL' })}
            onQuickFlip={handleQuickFlip}
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