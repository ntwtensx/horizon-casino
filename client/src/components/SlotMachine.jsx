import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { createCafeAudio } from '../utils/cafeAudio';
import { FOIL_TONES, resolveMenuCardTone, resolveSlotCardTone } from '../utils/eventTones';

const MENU_TITLES = ['☕ เครื่องดื่ม', '✨ ท็อปปิ้ง', '🍰 ขนม'];
const EVENT_TITLES = ['ช่อง 1 • จุดเริ่ม', 'ช่อง 2 • พลิกผัน', 'ช่อง 3 • ชะตา'];
const SPIN_EMOJIS = ['☕', '🧋', '🍵', '🥐', '🧁', '🍓', '🌸', '🍮', '✨', '🍯', '🧇', '🍡', '🪙', '🎰'];

const IDLE_MENU_SLOTS = [
  { icon: '☕', label: 'Horizon Latte', sub: 'พร้อมชงเมนู', menuTone: 'cafe-honey' },
  { icon: '☁️', label: 'ฟองนมละมุน', sub: 'โยกคันโยกเลย!', menuTone: 'cafe-sky' },
  { icon: '🥐', label: 'ครัวซองต์อุ่น', sub: 'ลากพลิกลุ้นชะตา', menuTone: 'cafe-lavender' }
];

const FALLBACK_EVENT_SLOTS = [
  { icon: '✨', label: 'ชะตา 1', sub: 'กำลังเปิดเผย', tone: 'zero' },
  { icon: '✨', label: 'ชะตา 2', sub: 'กำลังเปิดเผย', tone: 'zero' },
  { icon: '✨', label: 'ชะตา 3', sub: 'กำลังเปิดเผย', tone: 'zero' }
];

const BURST_VECTORS = [
  { tx: '-46px', ty: '-44px', rot: '-35deg', d: '0s' },
  { tx: '0px', ty: '-58px', rot: '12deg', d: '0.02s' },
  { tx: '48px', ty: '-42px', rot: '38deg', d: '0.04s' },
  { tx: '56px', ty: '4px', rot: '52deg', d: '0.01s' },
  { tx: '42px', ty: '48px', rot: '28deg', d: '0.05s' },
  { tx: '-4px', ty: '54px', rot: '-18deg', d: '0.03s' },
  { tx: '-44px', ty: '46px', rot: '-42deg', d: '0.04s' },
  { tx: '-54px', ty: '-2px', rot: '-50deg', d: '0.02s' }
];

const LEVER_MAX_DRAG = 44;
const LEVER_TRIGGER_Y = 26;

export default function SlotMachine({
  spinPhase = 'IDLE',
  spinProgress = 0,
  menuRevealedCount = 0,
  flippedSlots = [false, false, false],
  cafeMenuItems,
  slots,
  outcome,
  outcomeType,
  soundEnabled,
  disabled,
  onPullLever,
  onFlipCard
}) {
  const [spinTick, setSpinTick] = useState(0);
  const [isDraggingLever, setIsDraggingLever] = useState(false);
  const [slotBursts, setSlotBursts] = useState([null, null, null]);

  const audioRef = useRef(null);
  const prevMenuCountRef = useRef(0);
  const prevFlippedRef = useRef([false, false, false]);
  const prevPhaseRef = useRef('IDLE');
  const draggedRef = useRef(false);
  const isSwipeFlippingRef = useRef(false);
  const burstTimersRef = useRef([]);

  const leverY = useMotionValue(0);
  const rodScaleY = useTransform(leverY, [0, LEVER_MAX_DRAG], [1, 0.22]);
  const knobScale = useTransform(leverY, [0, LEVER_MAX_DRAG], [1, 1.08]);
  const pullProgress = useTransform(leverY, [0, LEVER_TRIGGER_Y], [0, 1]);

  if (!audioRef.current) audioRef.current = createCafeAudio();

  const isBusy = spinPhase === 'SPINNING' || spinPhase === 'MENU_SHOW';
  const canPull = !disabled && !isBusy;
  const flippedCount = flippedSlots.filter(Boolean).length;

  const menuList =
    Array.isArray(cafeMenuItems) && cafeMenuItems.length === 3 ? cafeMenuItems : IDLE_MENU_SLOTS;
  const eventList =
    Array.isArray(slots) && slots.length === 3 ? slots : FALLBACK_EVENT_SLOTS;

  useEffect(() => {
    const endSwipe = () => {
      isSwipeFlippingRef.current = false;
    };
    window.addEventListener('pointerup', endSwipe);
    window.addEventListener('pointercancel', endSwipe);
    return () => {
      window.removeEventListener('pointerup', endSwipe);
      window.removeEventListener('pointercancel', endSwipe);
      burstTimersRef.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (spinPhase !== 'SPINNING') return;
    const id = setInterval(() => {
      setSpinTick((t) => t + 1);
      if (soundEnabled) audioRef.current.tick();
    }, 90);
    return () => clearInterval(id);
  }, [spinPhase, soundEnabled]);

  useEffect(() => {
    if (menuRevealedCount === 0) {
      setSlotBursts([null, null, null]);
    } else if (menuRevealedCount > prevMenuCountRef.current) {
      for (let i = prevMenuCountRef.current; i < menuRevealedCount; i += 1) {
        if (soundEnabled) audioRef.current.stop(i);
        const icon = menuList[i]?.icon || '✨';
        const burstKey = `${Date.now()}-${i}`;
        setSlotBursts((prev) => {
          const next = [...prev];
          next[i] = { key: burstKey, icon };
          return next;
        });
        const tid = setTimeout(() => {
          setSlotBursts((prev) => {
            if (prev[i]?.key !== burstKey) return prev;
            const next = [...prev];
            next[i] = null;
            return next;
          });
        }, 820);
        burstTimersRef.current.push(tid);
      }
    }
    prevMenuCountRef.current = menuRevealedCount;
  }, [menuRevealedCount, soundEnabled, menuList]);

  useEffect(() => {
    flippedSlots.forEach((isFlipped, idx) => {
      if (isFlipped && !prevFlippedRef.current[idx] && soundEnabled) {
        audioRef.current.flipImpact(idx, eventList[idx]?.tone || 'zero');
      }
    });
    prevFlippedRef.current = [...flippedSlots];
  }, [flippedSlots, soundEnabled, eventList]);

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

  const flipCardAtPoint = (clientX, clientY) => {
    if (spinPhase !== 'MENU_SHOW') return;
    const cardNode = document.elementFromPoint(clientX, clientY)?.closest?.('[data-reel-idx]');
    if (!cardNode) return;
    const idx = Number(cardNode.getAttribute('data-reel-idx'));
    if (!Number.isNaN(idx)) onFlipCard(idx);
  };

  const springLeverBack = () => animate(leverY, 0, { type: 'spring', stiffness: 360, damping: 18 });

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

  const isRevealed = spinPhase === 'REVEALED';
  const shellClass = [
    'slot-machine-shell',
    isRevealed && ['JACKPOT', 'WIN'].includes(outcomeType) ? 'machine-glow-win' : '',
    isRevealed && outcomeType === 'MIRACLE' ? 'machine-glow-miracle' : '',
    isRevealed && ['TAX', 'THEFT', 'DIVIDER'].includes(outcomeType) ? 'machine-glow-bad' : '',
    isRevealed && ['JACKPOT', 'MIRACLE', 'DIVIDER'].includes(outcomeType) ? 'machine-shake' : '',
    spinPhase === 'MENU_SHOW' ? 'machine-glow-menu' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const barPercent =
    spinPhase === 'SPINNING'
      ? spinProgress
      : spinPhase === 'MENU_SHOW'
        ? Math.round((flippedCount / 3) * 100)
        : isRevealed
          ? 100
          : 0;

  const barCaption =
    spinPhase === 'SPINNING'
      ? `🌈 กำลังสุ่มเมนูคาเฟ่... ${spinProgress}%`
      : spinPhase === 'MENU_SHOW'
        ? `👆 แตะหรือลากกวาดผ่านการ์ดเพื่อพลิก (${flippedCount}/3)`
        : isRevealed
          ? '✨ เปิดชะตาครบ 3 ช่องแล้ว! โยกคันโยกเล่นรอบใหม่ได้เลย'
          : '🍒 ลากหรือแตะคันโยกด้านขวาเพื่อเริ่มปั่น';

  return (
    <motion.section
      className={shellClass}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 26, delay: 0.14 }}
    >
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

      <div className="machine-body">
        <div className={`reels-rainbow-wrap ${spinPhase === 'SPINNING' ? 'is-spinning-rainbow' : ''}`}>
          <div
            className={`reels-window ${spinPhase === 'MENU_SHOW' ? 'swipe-flip-active' : ''}`}
            onPointerDown={(e) => {
              if (spinPhase !== 'MENU_SHOW') return;
              isSwipeFlippingRef.current = true;
              flipCardAtPoint(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (isSwipeFlippingRef.current && spinPhase === 'MENU_SHOW') {
                flipCardAtPoint(e.clientX, e.clientY);
              }
            }}
            onPointerUp={() => {
              isSwipeFlippingRef.current = false;
            }}
            onPointerCancel={() => {
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
              const menuCardTone = resolveMenuCardTone(menuItem, idx);
              const eventCardTone = resolveSlotCardTone(eventItem, idx, outcome);
              const burst = slotBursts[idx];

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
                          {[0, 5, 9].map((offset) => (
                            <span className="reel-spin-emoji" key={offset}>
                              {SPIN_EMOJIS[(spinTick + idx * 3 + offset) % SPIN_EMOJIS.length]}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`reel-impact-wrapper ${isFlipped ? 'has-flipped-impact' : ''}`}
                        data-tone={eventCardTone}
                      >
                        <motion.div
                          className="flip-card-inner"
                          initial={false}
                          animate={{ rotateY: isFlipped ? 180 : 0 }}
                          transition={{ type: 'spring', stiffness: 290, damping: 20, mass: 0.85 }}
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          {/* ด้านหน้า: เมนูคาเฟ่พร้อมพื้นหลัง Cute Flowers ไล่ 3 เฉด */}
                          <div
                            className={`flip-face flip-face-front ${canTapToFlip ? 'tap-ready-card' : ''}`}
                            data-tone={menuCardTone}
                            data-slot-step={idx}
                          >
                            <motion.div
                              key={`menu-${idx}-${menuItem.label}`}
                              className="reel-card"
                              initial={isMenuJustLanded ? { y: -16, scale: 0.9, opacity: 0.5 } : false}
                              animate={{ y: 0, scale: 1, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                            >
                              {canTapToFlip && <span className="tap-flip-pill">👆 แตะ/ลาก</span>}
                              <div className="reel-icon">{menuItem.icon}</div>
                              <div className="reel-label menu-label">{menuItem.label}</div>
                              <div className="reel-sub">{menuItem.sub}</div>
                            </motion.div>
                          </div>

                          {/* ด้านหลัง: อีเวนท์ 3 ช่องไล่ 3 เฉดในชุดสีดอกไม้เดียวกัน + ฟอยล์โฮโลแกรมสำหรับการ์ดแรร์ */}
                          <div
                            className={`flip-face flip-face-back ${
                              FOIL_TONES.has(eventCardTone) ? 'foil-sheen' : ''
                            }`}
                            data-tone={eventCardTone}
                            data-slot-step={idx}
                          >
                            <div className="reel-card">
                              <div className="reel-icon">{eventItem.icon}</div>
                              <div className="reel-label">{eventItem.label}</div>
                              <div className="reel-sub">{eventItem.sub}</div>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )}

                    {/* ปาติเคิลอิโมจิของเมนูระเบิดกระจายจากกึ่งกลางการ์ดเมื่อวงล้อหยุด */}
                    {burst && (
                      <div key={burst.key} className="emoji-burst-layer" aria-hidden="true">
                        {BURST_VECTORS.map((v, bi) => (
                          <span
                            key={bi}
                            className="emoji-burst-dot"
                            style={{ '--tx': v.tx, '--ty': v.ty, '--rot': v.rot, '--d': v.d }}
                          >
                            {burst.icon}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* คันโยกด้านข้าง */}
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
              onDragStart={() => {
                draggedRef.current = true;
                setIsDraggingLever(true);
              }}
              onDragEnd={(_, info) => {
                setIsDraggingLever(false);
                const pulled = leverY.get() >= LEVER_TRIGGER_Y || info.offset.y >= LEVER_TRIGGER_Y;
                springLeverBack();
                if (pulled) firePullAndSpin();
                setTimeout(() => {
                  draggedRef.current = false;
                }, 100);
              }}
              onClick={() => {
                if (draggedRef.current) {
                  draggedRef.current = false;
                  return;
                }
                handleAutoPull();
              }}
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