import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

const MENU_TITLES = ['☕ เครื่องดื่ม', '✨ ท็อปปิ้ง', '🍰 ขนม'];
const EVENT_TITLES = ['ช่อง 1 • จุดเริ่ม', 'ช่อง 2 • พลิกผัน', 'ช่อง 3 • ชะตา'];

const SPIN_EMOJIS = ['☕', '🧋', '🍵', '🥐', '🧁', '🍓', '🌸', '🍮', '✨', '🍯', '🧇', '🍡', '🪙', '🎰'];

const IDLE_MENU_SLOTS = [
  { icon: '☕', label: 'Horizon Latte', sub: 'พร้อมชงเมนู', menuTone: 'cafe-honey' },
  { icon: '☁️', label: 'ฟองนมละมุน', sub: 'โยกคันโยกเลย!', menuTone: 'cafe-cream' },
  { icon: '🥐', label: 'ครัวซองต์อุ่น', sub: 'ลากพลิกลุ้นชะตา', menuTone: 'cafe-lavender' }
];

const FALLBACK_EVENT_SLOTS = [
  { icon: '✨', label: 'ชะตา 1', sub: 'กำลังเปิดเผย', tone: 'zero' },
  { icon: '✨', label: 'ชะตา 2', sub: 'กำลังเปิดเผย', tone: 'zero' },
  { icon: '✨', label: 'ชะตา 3', sub: 'กำลังเปิดเผย', tone: 'zero' }
];

const LEVER_MAX_DRAG = 44;
const LEVER_TRIGGER_Y = 26;

// 🔊 ตัวสังเคราะห์เสียงแนวคาเฟ่ผ่าน Web Audio API (เพิ่มเสียงกระแทก + ประกายแสงวาบตอนพลิกการ์ด)
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
    tick: () => tone(520 + Math.random() * 140, 0.03, 'sine', 0.022),
    stop: (idx) => tone(440 + idx * 110, 0.11, 'triangle', 0.085),

    // เอฟเฟคเสียงตอนการ์ดพลิก: 1) เสียงฟึ่บพลิก 2) เสียงกระแทกตุบ 3) เสียงประกายแสงวาบ
    flipImpact: (idx, cardTone = 'zero') => {
      const c = getCtx();
      if (!c) return;
      const now = c.currentTime;

      // 1) ฟึ่บตอนหมุนการ์ด
      const whoosh = c.createOscillator();
      const wg = c.createGain();
      whoosh.type = 'triangle';
      whoosh.frequency.setValueAtTime(280 + idx * 55, now);
      whoosh.frequency.exponentialRampToValueAtTime(560 + idx * 80, now + 0.07);
      wg.gain.setValueAtTime(0.001, now);
      wg.gain.exponentialRampToValueAtTime(0.065, now + 0.015);
      wg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      whoosh.connect(wg);
      wg.connect(c.destination);
      whoosh.start(now);
      whoosh.stop(now + 0.09);

      // 2) แรงกระแทก (Low-end Thump)
      const thud = c.createOscillator();
      const tg = c.createGain();
      thud.type = 'sine';
      const thudStart = now + 0.085;
      thud.frequency.setValueAtTime(175, thudStart);
      thud.frequency.exponentialRampToValueAtTime(48, thudStart + 0.11);
      tg.gain.setValueAtTime(0.001, thudStart);
      tg.gain.exponentialRampToValueAtTime(0.18, thudStart + 0.01);
      tg.gain.exponentialRampToValueAtTime(0.001, thudStart + 0.13);
      thud.connect(tg);
      tg.connect(c.destination);
      thud.start(thudStart);
      thud.stop(thudStart + 0.14);

      // 3) แสงวาบประกาย (Sparkle Chime ตามโทนสีการ์ด)
      const isDark = cardTone === 'tax' || cardTone === 'divide';
      const isGrand = cardTone === 'miracle' || cardTone === 'mult' || cardTone === 'win';
      const chimeFreq = isDark ? 390 + idx * 40 : isGrand ? 880 + idx * 140 : 660 + idx * 90;
      tone(chimeFreq, 0.16, isDark ? 'sawtooth' : 'sine', isDark ? 0.045 : 0.075, 0.095);
      if (isGrand) {
        tone(chimeFreq * 1.25, 0.2, 'triangle', 0.06, 0.13);
      }
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
  spinProgress = 0,
  menuRevealedCount = 0,
  flippedSlots = [false, false, false],
  cafeMenuItems,
  slots,
  outcomeType,
  soundEnabled,
  disabled,
  onPullLever,
  onFlipCard
}) {
  const [spinTick, setSpinTick] = useState(0);
  const [isDraggingLever, setIsDraggingLever] = useState(false);

  const audioRef = useRef(null);
  const prevMenuCountRef = useRef(0);
  const prevFlippedRef = useRef([false, false, false]);
  const prevPhaseRef = useRef('IDLE');
  const draggedRef = useRef(false);
  const isSwipeFlippingRef = useRef(false);

  const leverY = useMotionValue(0);
  const rodScaleY = useTransform(leverY, [0, LEVER_MAX_DRAG], [1, 0.22]);
  const knobScale = useTransform(leverY, [0, LEVER_MAX_DRAG], [1, 1.08]);
  const pullProgress = useTransform(leverY, [0, LEVER_TRIGGER_Y], [0, 1]);

  if (!audioRef.current) {
    audioRef.current = createCafeAudio();
  }

  const isBusy = spinPhase === 'SPINNING' || spinPhase === 'MENU_SHOW';
  const canPull = !disabled && !isBusy;
  const flippedCount = flippedSlots.filter(Boolean).length;

  const menuList =
    Array.isArray(cafeMenuItems) && cafeMenuItems.length === 3 ? cafeMenuItems : IDLE_MENU_SLOTS;
  const eventList =
    Array.isArray(slots) && slots.length === 3 ? slots : FALLBACK_EVENT_SLOTS;

  // รีเซ็ตสถานะการลากเปิดการ์ดเมื่อปล่อยนิ้ว/เมาส์นอกกรอบ
  useEffect(() => {
    const endSwipe = () => {
      isSwipeFlippingRef.current = false;
    };
    window.addEventListener('pointerup', endSwipe);
    window.addEventListener('pointercancel', endSwipe);
    return () => {
      window.removeEventListener('pointerup', endSwipe);
      window.removeEventListener('pointercancel', endSwipe);
    };
  }, []);

  // หมุนอิโมจิรัวๆ เฉพาะช่วง SPINNING
  useEffect(() => {
    if (spinPhase !== 'SPINNING') return;
    const id = setInterval(() => {
      setSpinTick((t) => t + 1);
      if (soundEnabled) audioRef.current.tick();
    }, 90);
    return () => clearInterval(id);
  }, [spinPhase, soundEnabled]);

  // เสียงตอนวงล้อเมนูหยุดทีละช่อง
  useEffect(() => {
    if (menuRevealedCount > prevMenuCountRef.current && menuRevealedCount > 0) {
      if (soundEnabled) audioRef.current.stop(menuRevealedCount - 1);
    }
    prevMenuCountRef.current = menuRevealedCount;
  }, [menuRevealedCount, soundEnabled]);

  // เสียงกระแทก + แสงวาบทุกครั้งที่การ์ดใบใดใบหนึ่งถูกพลิก
  useEffect(() => {
    flippedSlots.forEach((isFlipped, idx) => {
      if (isFlipped && !prevFlippedRef.current[idx] && soundEnabled) {
        const cardTone = eventList[idx]?.tone || 'zero';
        audioRef.current.flipImpact(idx, cardTone);
      }
    });
    prevFlippedRef.current = [...flippedSlots];
  }, [flippedSlots, soundEnabled, eventList]);

  // เสียงเฉลยรางวัล/โดนหัก เมื่อพลิกครบทั้ง 3 ใบ
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

  // ตรวจจับการ์ดที่นิ้ว/เมาส์แตะหรือลากผ่าน
  const flipCardAtPoint = (clientX, clientY) => {
    if (spinPhase !== 'MENU_SHOW') return;
    const el = document.elementFromPoint(clientX, clientY);
    const cardNode = el?.closest?.('[data-reel-idx]');
    if (!cardNode) return;
    const idx = Number(cardNode.getAttribute('data-reel-idx'));
    if (!Number.isNaN(idx)) {
      onFlipCard(idx);
    }
  };

  const handleReelsPointerDown = (e) => {
    if (spinPhase !== 'MENU_SHOW') return;
    isSwipeFlippingRef.current = true;
    flipCardAtPoint(e.clientX, e.clientY);
  };

  const handleReelsPointerMove = (e) => {
    if (!isSwipeFlippingRef.current || spinPhase !== 'MENU_SHOW') return;
    flipCardAtPoint(e.clientX, e.clientY);
  };

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
      duration: 0.16,
      ease: 'easeIn',
      onComplete: () => {
        firePullAndSpin();
        setTimeout(springLeverBack, 140);
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
  } else if (spinPhase === 'MENU_SHOW') {
    shellClass += ' machine-glow-menu';
  }

  const barPercent =
    spinPhase === 'SPINNING'
      ? spinProgress
      : spinPhase === 'MENU_SHOW'
        ? Math.round((flippedCount / 3) * 100)
        : spinPhase === 'REVEALED'
          ? 100
          : 0;

  const barCaption =
    spinPhase === 'SPINNING'
      ? `☕ กำลังสุ่มเมนูคาเฟ่... ${spinProgress}%`
      : spinPhase === 'MENU_SHOW'
        ? `👆 แตะหรือลากกวาดผ่านการ์ดเพื่อพลิก (${flippedCount}/3)`
        : spinPhase === 'REVEALED'
          ? '✨ เปิดชะตาครบ 3 ช่องแล้ว! โยกคันโยกเล่นรอบใหม่ได้เลย'
          : '🍒 ลากหรือแตะคันโยกด้านขวาเพื่อเริ่มปั่น';

  return (
    <motion.section
      className={shellClass}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* แถบหัวตู้ + โปรเกรสบาร์ */}
      <div className="machine-top-strip">
        <div className="machine-status-row">
          <span className="machine-status-text">{barCaption}</span>
          <div className="machine-lights" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`light-dot ${
                  spinPhase === 'SPINNING'
                    ? 'spinning'
                    : spinPhase === 'MENU_SHOW' || isRevealed
                      ? 'lit'
                      : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="spin-progress-track" aria-hidden="true">
          <motion.div
            className={`spin-progress-fill ${spinPhase === 'MENU_SHOW' ? 'mode-flip' : ''}`}
            initial={false}
            animate={{ width: `${barPercent}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ตัวตู้ 3 ช่อง (รองรับลากผ่านเพื่อเปิดเรียงกัน) + คันโยกด้านข้าง */}
      <div className="machine-body">
        <div
          className={`reels-window ${spinPhase === 'MENU_SHOW' ? 'swipe-flip-active' : ''}`}
          onPointerDown={handleReelsPointerDown}
          onPointerMove={handleReelsPointerMove}
          onPointerUp={() => {
            isSwipeFlippingRef.current = false;
          }}
        >
          {[0, 1, 2].map((idx) => {
            const isReelSpinning = spinPhase === 'SPINNING' && menuRevealedCount <= idx;
            const isAnticipating = isReelSpinning && idx === 2 && menuRevealedCount === 2;
            const isMenuJustLanded =
              (spinPhase === 'SPINNING' || spinPhase === 'MENU_SHOW') && menuRevealedCount > idx;
            const isFlipped =
              Boolean(flippedSlots[idx]) && spinPhase !== 'IDLE' && spinPhase !== 'SPINNING';
            const canTapToFlip = spinPhase === 'MENU_SHOW' && !isFlipped;

            const menuItem = menuList[idx] || IDLE_MENU_SLOTS[idx];
            const eventItem = eventList[idx] || FALLBACK_EVENT_SLOTS[idx];
            const cardTone = eventItem.tone || 'zero';

            const e1 = SPIN_EMOJIS[(spinTick + idx * 3) % SPIN_EMOJIS.length];
            const e2 = SPIN_EMOJIS[(spinTick + idx * 3 + 5) % SPIN_EMOJIS.length];
            const e3 = SPIN_EMOJIS[(spinTick + idx * 3 + 9) % SPIN_EMOJIS.length];

            return (
              <div className="reel-column" key={idx}>
                <div className={`reel-step-label ${isFlipped ? 'is-event' : 'is-menu'}`}>
                  {isFlipped ? EVENT_TITLES[idx] : MENU_TITLES[idx]}
                </div>

                <div
                  data-reel-idx={idx}
                  className={`reel-slot-stage ${canTapToFlip ? 'can-tap-flip' : ''}`}
                  role={canTapToFlip ? 'button' : undefined}
                  tabIndex={canTapToFlip ? 0 : undefined}
                  aria-label={canTapToFlip ? `แตะหรือลากเพื่อพลิกการ์ดช่องที่ ${idx + 1}` : undefined}
                  onKeyDown={(e) => {
                    if (canTapToFlip && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onFlipCard(idx);
                    }
                  }}
                >
                  {isReelSpinning ? (
                    <div className={`reel-spin-box ${isAnticipating ? 'reel-anticipation' : ''}`}>
                      <div className="reel-spin-blur">
                        <span className="reel-spin-emoji">{e1}</span>
                        <span className="reel-spin-emoji">{e2}</span>
                        <span className="reel-spin-emoji">{e3}</span>
                      </div>
                    </div>
                  ) : (
                    /* ตัวครอบสร้างแรงกระแทกและแสงวาบเมื่อการ์ดพลิก */
                    <motion.div
                      className="reel-impact-wrapper"
                      animate={
                        isFlipped
                          ? {
                              scale: [1, 1.09, 0.93, 1.02, 1],
                              y: [0, -7, 3, -1, 0],
                              rotate: [0, idx === 0 ? -2 : idx === 2 ? 2 : 1.2, 0]
                            }
                          : { scale: 1, y: 0, rotate: 0 }
                      }
                      transition={{ duration: 0.44, times: [0, 0.32, 0.58, 0.82, 1], ease: 'easeOut' }}
                    >
                      <motion.div
                        className="flip-card-inner"
                        initial={false}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 290,
                          damping: 20,
                          mass: 0.85
                        }}
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        {/* ด้านหน้า: เมนูคาเฟ่ */}
                        <div
                          className={`flip-face flip-face-front menu-tone-${
                            menuItem.menuTone || 'cafe-cream'
                          } ${canTapToFlip ? 'tap-ready-card' : ''}`}
                        >
                          <motion.div
                            key={`menu-${idx}-${menuItem.label}-${isMenuJustLanded ? 'in' : 'idle'}`}
                            className="reel-card"
                            initial={isMenuJustLanded ? { y: -18, scale: 0.92, opacity: 0.5 } : false}
                            animate={{ y: 0, scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                          >
                            {canTapToFlip && <span className="tap-flip-pill">👆 แตะ/ลาก</span>}
                            <div className="reel-icon">{menuItem.icon}</div>
                            <div className="reel-label menu-label">{menuItem.label}</div>
                            <div className="reel-sub">{menuItem.sub}</div>
                          </motion.div>
                        </div>

                        {/* ด้านหลัง: อีเวนท์ 3 ช่องหลังพลิก */}
                        <div className={`flip-face flip-face-back tone-${cardTone}`}>
                          <div className="reel-card">
                            <div className="reel-icon">{eventItem.icon}</div>
                            <div className="reel-label">{eventItem.label}</div>
                            <div className="reel-sub">{eventItem.sub}</div>
                          </div>
                        </div>
                      </motion.div>

                      {/* เอฟเฟคแสงวาบ + ลำแสงพาดเฉียง + วงแหวนแรงกระแทก */}
                      {isFlipped && (
                        <>
                          <motion.div
                            key={`flash-${idx}-${eventItem.label}`}
                            className={`card-flash-burst flash-tone-${cardTone}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: [0, 0.95, 0], scale: [0.85, 1.08, 1.15] }}
                            transition={{ duration: 0.42, times: [0, 0.28, 1], ease: 'easeOut' }}
                          />
                          <motion.div
                            key={`sweep-${idx}-${eventItem.label}`}
                            className="card-shine-sweep"
                            initial={{ x: '-130%', opacity: 0.9 }}
                            animate={{ x: '150%', opacity: 0 }}
                            transition={{ duration: 0.48, delay: 0.08, ease: 'easeOut' }}
                          />
                          <motion.div
                            key={`ring-${idx}-${eventItem.label}`}
                            className={`card-impact-ring ring-tone-${cardTone}`}
                            initial={{ opacity: 0.95, scale: 0.9 }}
                            animate={{ opacity: 0, scale: 1.18 }}
                            transition={{ duration: 0.44, delay: 0.06, ease: 'easeOut' }}
                          />
                        </>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* คันโยกด้านข้าง (แสดงตลอดทั้งจอคอมและมือถือ) */}
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
              <span>{spinPhase === 'SPINNING' ? '✨' : spinPhase === 'MENU_SHOW' ? '🃏' : '🍒'}</span>
            </motion.div>
          </div>

          <div className="lever-hint">
            {spinPhase === 'SPINNING'
              ? 'กำลังปั่น'
              : spinPhase === 'MENU_SHOW'
                ? 'พลิกการ์ด'
                : isDraggingLever
                  ? 'ปล่อยเลย!'
                  : 'โยก ↓'}
          </div>
        </div>
      </div>
    </motion.section>
  );
}