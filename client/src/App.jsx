import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { casinoApi } from './api';
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
  const [soundEnabled, setSoundEnabled] = useState(true);

  // สถานะตู้สล็อต & ผลลัพธ์รอบปัจจุบัน
  const [isSpinning, setIsSpinning] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [spinResult, setSpinResult] = useState(null);
  const [isBrandNewStamp, setIsBrandNewStamp] = useState(false);
  const [spinError, setSpinError] = useState('');

  const timersRef = useRef([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

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
  }, [loadCasinoData]);

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

  const handleAuthenticated = (player, pin) => {
    setActivePlayer(player);
    setVerifiedPin(pin);
    setAuthModalOpen(false);
    setSpinResult(null);
    setRevealedCount(0);
    setSpinError('');
    setPlayers((prev) => prev.map((p) => (p.userId === player.userId ? { ...p, hasPin: true } : p)));
  };

  const handlePullLever = async () => {
    if (!activePlayer) {
      setAuthModalOpen(true);
      return;
    }
    if (isSpinning) return;

    clearTimers();
    setSpinError('');
    setIsBrandNewStamp(false);
    setLeverPulled(true);
    setIsSpinning(true);
    setRevealedCount(0);

    // ดีดคันโยกกลับหลังดึงลง
    timersRef.current.push(setTimeout(() => setLeverPulled(false), 380));

    const prevStamps = new Set(activePlayer.collectedStamps || []);
    const spinStartedAt = Date.now();
    const res = await casinoApi.spin(activePlayer.userId, verifiedPin);

    if (!res.ok) {
      setIsSpinning(false);
      setSpinError(res.error || 'ไม่สามารถหมุนสล็อตได้ในขณะนี้ค่ะ');
      return;
    }

    const brandNew = Boolean(res.unlockedStampId && !prevStamps.has(res.unlockedStampId));
    setSpinResult(res);
    setIsBrandNewStamp(brandNew);

    // คุมจังหวะหยุดทีละช่อง: ช่อง 1 -> ช่อง 2 -> ช่อง 3 (ชะลอลุ้นระทึก)
    const elapsed = Date.now() - spinStartedAt;
    const stop1Delay = Math.max(250, 900 - elapsed);
    const stop2Delay = stop1Delay + 700;
    const stop3Delay = stop2Delay + 950;

    timersRef.current.push(setTimeout(() => setRevealedCount(1), stop1Delay));
    timersRef.current.push(setTimeout(() => setRevealedCount(2), stop2Delay));
    timersRef.current.push(
      setTimeout(() => {
        setRevealedCount(3);
        setIsSpinning(false);

        // อัปเดตยอดเงินและสถานะโลกหลังหยุดครบ 3 ช่อง (กันสปอยล์ก่อนวงล้อหยุด)
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
      }, stop3Delay)
    );
  };

  const statusPill = activePlayer
    ? getStatusPill(activePlayer.walletBalance, activePlayer.walletBalance > 0 && activePlayer.walletBalance >= maxWallet)
    : null;

  return (
    <div className="cafe-app">
      {/* แถบบน Cafe HUD */}
      <header className="cafe-hud">
        <div className="hud-top">
          <div className="hud-brand">
            <div className="brand-title">
              <span>☕ Horizon Casino</span>
              <span className="brand-badge">Cafe Slot</span>
            </div>

            {/* แลนด์มาร์กริมหน้าต่าง 5 โซน */}
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
              disabled={isSpinning}
            >
              👤 เปลี่ยนผู้เล่น
            </button>
          </div>
        </div>

        {/* แถบโปรไฟล์และกระเป๋าตังค์ */}
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
                </div>
                <div className="player-sub-row">
                  {statusPill && <span className={`status-pill ${statusPill.cls}`}>{statusPill.text}</span>}
                  <span>• ปั่นไปแล้ว {Number(activePlayer.scratchCount || 0).toLocaleString()} รอบ</span>
                </div>
              </div>
            </div>

            <div className="hud-wallet-group">
              <div className="tipjar-pill" title="กระปุกหมูสะสมจากคนที่โดนหักเงินในร้าน">
                🐷 กระปุกหมู: {Number(tipJar || 0).toLocaleString()}
              </div>
              <div className="wallet-pill">
                <span className="wallet-label">👛 กระเป๋าตังค์:</span>
                <span className={`wallet-value ${activePlayer.walletBalance < 0 ? 'negative' : ''}`}>
                  {Number(activePlayer.walletBalance || 0).toLocaleString()} 🪙
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* เวทีหลัก: ตู้สล็อต + กล่องอีเวนท์ */}
      <main className="casino-stage">
        <SlotMachine
          isSpinning={isSpinning}
          leverPulled={leverPulled}
          revealedCount={revealedCount}
          slots={spinResult?.outcome?.slots}
          outcomeType={spinResult?.outcome?.outcomeType}
          soundEnabled={soundEnabled}
          disabled={!activePlayer}
          onPullLever={handlePullLever}
        />

        <EventDisplay
          isSpinning={isSpinning}
          revealedCount={revealedCount}
          spinResult={spinResult}
          isBrandNewStamp={isBrandNewStamp}
          matchedStamp={matchedStamp}
          errorMsg={spinError}
          onOpenStampBook={(cat) => setStampModalState({ open: true, category: cat || 'ALL' })}
        />
      </main>

      {/* ป๊อบอัพบังคับเลือกผู้เล่น & ยืนยัน PIN 4 หลัก */}
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

      {/* ป๊อบอัพสมุดสะสมแสตมป์ 158 ดวง */}
      <StampBookModal
        isOpen={stampModalState.open}
        onClose={() => setStampModalState((s) => ({ ...s, open: false }))}
        stampCatalog={stampCatalog}
        activePlayer={activePlayer}
        initialCategory={stampModalState.category}
      />
    </div>
  );
}