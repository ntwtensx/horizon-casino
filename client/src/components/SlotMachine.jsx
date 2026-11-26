import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

const MENU_TITLES = ['☕ เครื่องดื่ม', '✨ ท็อปปิ้ง', '🍰 ขนมทานเล่น'];
const EVENT_TITLES = ['ช่องที่ 1 • จุดเริ่มต้น', 'ช่องที่ 2 • จุดพลิกผัน', 'ช่องที่ 3 • ชะตาปาฏิหาริย์'];

const SPIN_EMOJIS = ['☕', '🧋', '🍵', '🥐', '🧁', '🍓', '🌸', '🍮', '✨', '🍯', '🧇', '🍡', '🪙', '🎰'];

const IDLE_MENU_SLOTS = [
  { icon: '☕', label: 'Horizon Latte', sub: 'พร้อมชงเมนูพิเศษ', menuTone: 'cafe-honey' },
  { icon: '☁️', label: 'ฟองนมนุ่มละมุน', sub: 'ลากคันโยกสั่งเลย!', menuTone: 'cafe-cream' },
  { icon: '🥐', label: 'ครัวซองต์อุ่นๆ', sub: 'ลุ้นพลิกการ์ด 158+ แบบ', menuTone: 'cafe-lavender' }
];

const FALLBACK_EVENT_SLOTS = [
  { icon: '✨', label: 'ชะตาที่ 1', sub: 'กำลังเปิดเผย', tone: 'zero' },
  { icon: '✨', label: 'ชะตาที่ 2', sub: 'กำลังเปิดเผย', tone: 'zero' },
  { icon: '✨', label: 'ชะตาที่ 3', sub: 'กำลังเปิดเผย', tone: 'zero' }
];

const LEVER_MAX_DRAG = 58;
const LEVER_TRIGGER_Y = 34;

// 🔊 ตัวสังเคราะห์เสียงแนวคาเฟ่ผ่าน Web Audio API (เพิ่มเสียงพลิกการ์ด 3D)
function createCafeAudio() {
  let ctx = null;
  const getCtx = () => {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };

  const tone = (freq, duration = 0.09, type = 'sine', gainVal = 0.08, delay = 0) => {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  };

  return {
    lever: () => {
      tone(240, 0.07, 'triangle', 0.09, 0);
      tone(155, 0.11, 'triangle', 0.08, 0.05);
    },
    tick: () => tone(520 + Math.random() * 140, 0.03, 'sine', 0.024),
    stop: (idx) => tone(440 + idx * 110, 0.11, 'triangle', 0.085),
    flip: (idx) => {
      const c = getCtx();
      if (!c) return;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280 + idx * 70, now);
      osc.frequency.exponentialRampToValueAtTime(560 + idx * 90, now + 0.07);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.075, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    },
    win: () => {
      tone(523.25, 0.14, 'triangle', 0.09, 0);
      tone(659.25, 0.14, 'triangle', 0.09, 0.1);
      tone(783.99, 0.22, 'triangle', 0.1, 0.2);
      tone(1046.5, 0.32, 'sine', 0.09, 0.3);
    },
    bad: () => {
      tone(340, 0.14, 'sawtooth', 0.05, 0);
      tone(260, 0.24, 'sawtooth', 0.05, 0.13);
    },
    zero: () => {
      tone(392, 0.1, 'sine', 0.06, 0);
      tone(350, 0.16, 'sine', 0.05, 0.11);
    }
  };
}

export default function SlotMachine({
  spinPhase = 'IDLE',
  menuRevealedCount = 0,
  flippedCount = 0,
  cafeMenuItems,
  slots,
  outcomeType,
  soundEnabled,
  disabled,
  onPullLever,
  onQuickFlip
}) {
  const [spinTick, setSpinTick] = useState(0);
  const [isDraggingLever, setIsDraggingLever] = useState(false);

  const audioRef = useRef(null);
  const prevMenuCountRef = useRef(0);
  const prevFlipCountRef = useRef(0);
  const prevPhaseRef = useRef('IDLE');
  const draggedRef = useRef(false);

  const leverY = useMotionValue(0);
  const rodScaleY = useTransform(leverY, [0, LEVER_MAX_DRAG], [1, 0.22]);
  const knobScale = useTransform(leverY, [0, LEVER_MAX_DRAG], [1, 1.1]);
  const pullProgress = useTransform(leverY, [0, LEVER_TRIGGER_Y], [0, 1]);

  if (!audioRef.current) {
    audioRef.current = createCafeAudio();
  }

  const isBusy = spinPhase === 'SPINNING' || spinPhase === 'MENU_SHOW' || spinPhase === 'FLIPPING';
  const canPull = !disabled && !isBusy;
  const canQuickFlip = spinPhase === 'MENU_SHOW';

  // หมุนอิโมจิรัวๆ เฉพาะช่วง SPINNING
  useEffect(() => {
    if (spinPhase !== 'SPINNING') return;
    const id = setInterval(() => {
      setSpinTick((t) => t + 1);
      if (soundEnabled) audioRef.current.tick();
    }, 95);
    return () => clearInterval(id);
  }, [spinPhase, soundEnabled]);

  // เสียงตอนวงล้อเมนูหยุดทีละช่อง
  useEffect(() => {
    if (menuRevealedCount > prevMenuCountRef.current && menuRevealedCount > 0) {
      if (soundEnabled) audioRef.current.stop(menuRevealedCount - 1);
    }
    prevMenuCountRef.current = menuRevealedCount;
  }, [menuRevealedCount, soundEnabled]);

  // เสียงตอนการ์ดพลิก 3D ไล่เวฟทีละใบ
  useEffect(() => {
    if (flippedCount > prevFlipCountRef.current && flippedCount > 0) {
      if (soundEnabled) audioRef.current.flip(flippedCount - 1);
    }
    prevFlipCountRef.current = flippedCount;
  }, [flippedCount, soundEnabled]);

  // เสียงเฉลยรางวัล/โดนหัก เมื่อพลิกครบเข้าสู่ REVEALED
  useEffect(() => {
    if (spinPhase === 'REVEALED' && prevPhaseRef.current !== 'REVEALED' && outcomeType) {
      if (soundEnabled) {
        if (['JACKPOT', 'WIN', 'MIRACLE'].includes(outcomeType)) audioRef.current.win();
        else if (['TAX', 'THEFT', 'DIVIDER'].includes(outcomeType)) audioRef.current.bad();
        else audioRef.current.zero();
      }
    }
    prevPhaseRef.current = spinPhase;
  }, [spinPhase, outcomeType, soundEnabled]);

  const springLeverBack = () => {
    animate(leverY, 0, { type: 'spring', stiffness: 360, damping: 18 });
  };

  const firePullAndSpin = () => {
    if (!canPull) return;
    if (soundEnabled) audioRef.current.lever();
    onPullLever();
  };

  const handleAutoPull = () => {
    if (!canPull) return;
    animate(leverY, LEVER_MAX_DRAG, {
      duration: 0.18,
      ease: 'easeIn',
      onComplete: () => {
        firePullAndSpin();
        setTimeout(springLeverBack, 160);
      }
    });
  };

  const handleKnobClick = () => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    handleAutoPull();
  };

  const handleDragStart = () => {
    draggedRef.current = true;
    setIsDraggingLever(true);
  };

  const handleDragEnd = (_, info) => {
    setIsDraggingLever(false);
    const pulledEnough = leverY.get() >= LEVER_TRIGGER_Y || info.offset.y >= LEVER_TRIGGER_Y;
    springLeverBack();
    if (pulledEnough) {
      firePullAndSpin();
    }
    setTimeout(() => {
      draggedRef.current = false;
    }, 100);
  };

  const isRevealed = spinPhase === 'REVEALED';

  let shellClass = 'slot-machine-shell';
  if (isRevealed) {
    if (outcomeType === 'JACKPOT' || outcomeType === 'WIN') shellClass += ' machine-glow-win';
    else if (outcomeType === 'MIRACLE') shellClass += ' machine-glow-miracle';
    else if (['TAX', 'THEFT', 'DIVIDER'].includes(outcomeType)) shellClass += ' machine-glow-bad';

    if (['JACKPOT', 'MIRACLE', 'DIVIDER'].includes(outcomeType)) {
      shellClass += ' machine-shake';
    }
  } else if (spinPhase === 'MENU_SHOW' || spinPhase === 'FLIPPING') {
    shellClass += ' machine-glow-menu';
  }

  const menuList =
    Array.isArray(cafeMenuItems) && cafeMenuItems.length === 3 ? cafeMenuItems : IDLE_MENU_SLOTS;
  const eventList =
    Array.isArray(slots) && slots.length === 3 ? slots : FALLBACK_EVENT_SLOTS;

  const phaseHintText =
    spinPhase === 'SPINNING'
      ? '• กำลังชงเมนูคาเฟ่...'
      : spinPhase === 'MENU_SHOW'
        ? '• เสิร์ฟเมนูครบแล้ว! แตะการ์ดเพื่อเปิดบิลทันที'
        : spinPhase === 'FLIPPING'
          ? '• กำลังพลิกการ์ดชะตา!'
          : '• สุ่มเมนู 3 ช่องแล้วพลิกการ์ดลุ้นชะตา';

  return (
    <motion.section
      className={shellClass}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="machine-header">
        <div className="machine-title">
          <span>🎰 HORIZON CAFE SLOT</span>
          <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--mocha-muted)' }}>
            {phaseHintText}
          </span>
        </div>
        <div className="machine-lights" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`light-dot ${
                spinPhase === 'SPINNING' || spinPhase === 'FLIPPING'
                  ? 'spinning'
                  : spinPhase === 'MENU_SHOW' || isRevealed
                    ? 'lit'
                    : ''
              }`}
            />
          ))}
        </div>
      </div>

      <div className="machine-body">
        <div
          className={`reels-window ${canQuickFlip ? 'can-quick-flip' : ''}`}
          onClick={canQuickFlip ? onQuickFlip : undefined}
          title={canQuickFlip ? 'คลิกเพื่อพลิกการ์ดเปิดบิลทันที' : undefined}
        >
          {[0, 1, 2].map((idx) => {
            const isReelSpinning = spinPhase === 'SPINNING' && menuRevealedCount <= idx;
            const isAnticipating = isReelSpinning && idx === 2 && menuRevealedCount === 2;
            const isMenuJustLanded =
              (spinPhase === 'SPINNING' || spinPhase === 'MENU_SHOW') && menuRevealedCount > idx;
            const isFlipped = flippedCount > idx && spinPhase !== 'IDLE' && spinPhase !== 'SPINNING';

            const menuItem = menuList[idx] || IDLE_MENU_SLOTS[idx];
            const eventItem = eventList[idx] || FALLBACK_EVENT_SLOTS[idx];

            const e1 = SPIN_EMOJIS[(spinTick + idx * 3) % SPIN_EMOJIS.length];
            const e2 = SPIN_EMOJIS[(spinTick + idx * 3 + 5) % SPIN_EMOJIS.length];
            const e3 = SPIN_EMOJIS[(spinTick + idx * 3 + 9) % SPIN_EMOJIS.length];

            return (
              <div className="reel-column" key={idx}>
                <div className={`reel-step-label ${isFlipped ? 'is-event' : 'is-menu'}`}>
                  {isFlipped ? EVENT_TITLES[idx] : MENU_TITLES[idx]}
                </div>

                <div className="reel-slot-stage">
                  {isReelSpinning ? (
                    <div
                      className={`reel-spin-box ${isAnticipating ? 'reel-anticipation' : ''}`}
                    >
                      <div className="reel-spin-blur">
                        <span className="reel-spin-emoji">{e1}</span>
                        <span className="reel-spin-emoji">{e2}</span>
                        <span className="reel-spin-emoji">{e3}</span>
                      </div>
                    </div>
                  ) : (
                    <motion.div
                      className="flip-card-inner"
                      initial={false}
                      animate={{ rotateY: isFlipped ? 180 : 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 260,
                        damping: 22,
                        mass: 0.9
                      }}
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {/* ด้านหน้า: การ์ดเมนูคาเฟ่ (เครื่องดื่ม / ท็อปปิ้ง / ขนมทานเล่น) */}
                      <div
                        className={`flip-face flip-face-front menu-tone-${
                          menuItem.menuTone || 'cafe-cream'
                        } ${spinPhase === 'MENU_SHOW' ? 'menu-ready-shimmer' : ''}`}
                      >
                        <motion.div
                          key={`menu-${idx}-${menuItem.label}-${isMenuJustLanded ? 'in' : 'idle'}`}
                          className="reel-card"
                          initial={isMenuJustLanded ? { y: -22, scale: 0.92, opacity: 0.5 } : false}
                          animate={{ y: 0, scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                        >
                          <span className="menu-card-badge">
                            {spinPhase === 'IDLE' ? 'CAFE MENU' : 'ORDER SERVED'}
                          </span>
                          <div className="reel-icon">{menuItem.icon}</div>
                          <div className="reel-label menu-label">{menuItem.label}</div>
                          <div className="reel-sub">{menuItem.sub}</div>
                        </motion.div>
                      </div>

                      {/* ด้านหลัง: ผลลัพธ์อีเวนท์ 3 ช่องหลังพลิกการ์ด */}
                      <div className={`flip-face flip-face-back tone-${eventItem.tone || 'zero'}`}>
                        <div className="reel-card">
                          <div className="reel-icon">{eventItem.icon}</div>
                          <div className="reel-label">{eventItem.label}</div>
                          <div className="reel-sub">{eventItem.sub}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* คันโยกที่จับลากลงได้จริง */}
        <div className="lever-assembly">
          <div className={`lever-interactive-box ${canPull ? '' : 'is-disabled'}`}>
            <div className="lever-slot-mount">
              <div className="lever-track">
                <motion.div className="lever-track-glow" style={{ opacity: pullProgress }} />
              </div>
            </div>

            <motion.div className="lever-rod-dynamic" style={{ scaleY: rodScaleY }} />

            <motion.div
              className={`lever-knob-draggable ${isDraggingLever ? 'grabbing' : ''}`}
              style={{ y: leverY, scale: knobScale }}
              drag={canPull ? 'y' : false}
              dragConstraints={{ top: 0, bottom: LEVER_MAX_DRAG }}
              dragElastic={0.08}
              dragMomentum={false}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onClick={handleKnobClick}
              whileHover={canPull ? { scale: 1.07 } : undefined}
              role="button"
              tabIndex={canPull ? 0 : -1}
              aria-label="ลากหรือคลิกคันโยกเพื่อปั่นสล็อต"
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && canPull) {
                  e.preventDefault();
                  handleAutoPull();
                }
              }}
            >
              <span>{isBusy ? '✨' : '🍒'}</span>
            </motion.div>
          </div>

          <div className="lever-hint">
            {spinPhase === 'SPINNING'
              ? 'กำลังชง...'
              : spinPhase === 'MENU_SHOW'
                ? 'รอพลิกการ์ด...'
                : spinPhase === 'FLIPPING'
                  ? 'เปิดบิล!'
                  : isDraggingLever
                    ? 'ปล่อยเพื่อปั่น!'
                    : 'ลากลง ↓\nหรือคลิก'}
          </div>
        </div>
      </div>

      {/* ปุ่มสำหรับหน้าจอมือถือ */}
      <div className="mobile-spin-row">
        {canQuickFlip ? (
          <motion.button
            type="button"
            className="btn-spin-main btn-quick-flip"
            onClick={onQuickFlip}
            whileTap={{ scale: 0.95 }}
          >
            🃏 แตะเปิดบิลพลิกการ์ดเลย!
          </motion.button>
        ) : (
          <motion.button
            type="button"
            className="btn-spin-main"
            onClick={handleAutoPull}
            disabled={!canPull}
            whileTap={canPull ? { scale: 0.95 } : undefined}
          >
            {spinPhase === 'SPINNING'
              ? '☕ กำลังชงเมนูพิเศษ...'
              : spinPhase === 'FLIPPING'
                ? '🃏 กำลังพลิกการ์ดชะตา...'
                : '🍒 โยกคันโยกปั่นสล็อต!'}
          </motion.button>
        )}
      </div>
    </motion.section>
  );
}