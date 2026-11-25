import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

const REEL_TITLES = ['ช่องที่ 1 • จุดเริ่มต้น', 'ช่องที่ 2 • จุดพลิกผัน', 'ช่องที่ 3 • ชะตาปาฏิหาริย์'];
const SPIN_EMOJIS = ['☕', '🪙', '💎', '🥐', '🍀', '🐜', '🛸', '👑', '🪓', '🎰', '🌸', '🐷', '🦆', '👻'];
const IDLE_SLOTS = [
  { icon: '☕', label: 'Horizon', sub: 'พร้อมลุ้นดวง', tone: 'zero' },
  { icon: '🎰', label: 'Lucky 3', sub: 'ลากคันโยกเลย!', tone: 'win' },
  { icon: '✨', label: 'Miracle', sub: '158+ อีเวนท์ป่วน', tone: 'miracle' }
];

const LEVER_MAX_DRAG = 58;
const LEVER_TRIGGER_Y = 34;

// 🔊 ตัวสังเคราะห์เสียงนุ่มๆ แนวคาเฟ่ผ่าน Web Audio API
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
    tick: () => tone(520 + Math.random() * 140, 0.03, 'sine', 0.025),
    stop: (idx) => tone(440 + idx * 120, 0.12, 'triangle', 0.09),
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
  isSpinning,
  revealedCount,
  slots,
  outcomeType,
  soundEnabled,
  disabled,
  onPullLever
}) {
  const [spinTick, setSpinTick] = useState(0);
  const [isDraggingLever, setIsDraggingLever] = useState(false);

  const audioRef = useRef(null);
  const prevRevealedRef = useRef(0);
  const draggedRef = useRef(false);

  // ค่าฟิสิกส์การลากคันโยก (0 = บนสุด, 58 = ดึงสุด)
  const leverY = useMotionValue(0);
  const rodScaleY = useTransform(leverY, [0, LEVER_MAX_DRAG], [1, 0.22]);
  const knobScale = useTransform(leverY, [0, LEVER_MAX_DRAG], [1, 1.1]);
  const pullProgress = useTransform(leverY, [0, LEVER_TRIGGER_Y], [0, 1]);

  if (!audioRef.current) {
    audioRef.current = createCafeAudio();
  }

  useEffect(() => {
    if (!isSpinning) return;
    const id = setInterval(() => {
      setSpinTick((t) => t + 1);
      if (soundEnabled) audioRef.current.tick();
    }, 95);
    return () => clearInterval(id);
  }, [isSpinning, soundEnabled]);

  useEffect(() => {
    if (revealedCount > prevRevealedRef.current && revealedCount > 0) {
      if (soundEnabled) {
        audioRef.current.stop(revealedCount - 1);
        if (revealedCount === 3 && outcomeType) {
          setTimeout(() => {
            if (['JACKPOT', 'WIN', 'MIRACLE'].includes(outcomeType)) audioRef.current.win();
            else if (['TAX', 'THEFT', 'DIVIDER'].includes(outcomeType)) audioRef.current.bad();
            else audioRef.current.zero();
          }, 140);
        }
      }
    }
    prevRevealedRef.current = revealedCount;
  }, [revealedCount, outcomeType, soundEnabled]);

  const springLeverBack = () => {
    animate(leverY, 0, { type: 'spring', stiffness: 360, damping: 18 });
  };

  const firePullAndSpin = () => {
    if (disabled || isSpinning) return;
    if (soundEnabled) audioRef.current.lever();
    onPullLever();
  };

  // คลิกคันโยกหรือปุ่มมือถือ -> โยกลงอัตโนมัติแล้วดีดกลับ
  const handleAutoPull = () => {
    if (disabled || isSpinning) return;
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

  const finished = !isSpinning && revealedCount === 3 && slots && slots.length === 3;

  let shellClass = 'slot-machine-shell';
  if (finished) {
    if (outcomeType === 'JACKPOT' || outcomeType === 'WIN') shellClass += ' machine-glow-win';
    else if (outcomeType === 'MIRACLE') shellClass += ' machine-glow-miracle';
    else if (['TAX', 'THEFT', 'DIVIDER'].includes(outcomeType)) shellClass += ' machine-glow-bad';

    if (['JACKPOT', 'MIRACLE', 'DIVIDER'].includes(outcomeType)) {
      shellClass += ' machine-shake';
    }
  }

  const displaySlots = slots && slots.length === 3 ? slots : IDLE_SLOTS;
  const canPull = !disabled && !isSpinning;

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
            • 3 วงล้อสุ่มชะตาป่วน
          </span>
        </div>
        <div className="machine-lights" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`light-dot ${isSpinning ? 'spinning' : finished ? 'lit' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="machine-body">
        <div className="reels-window">
          {[0, 1, 2].map((idx) => {
            const isReelSpinning = isSpinning && revealedCount <= idx;
            const isAnticipating = isReelSpinning && idx === 2 && revealedCount === 2;
            const isJustStopped = revealedCount > idx && slots && slots.length === 3;
            const item = displaySlots[idx] || IDLE_SLOTS[idx];

            let viewportClass = 'reel-viewport';
            if (isReelSpinning) {
              viewportClass += isAnticipating ? ' reel-spinning reel-anticipation' : ' reel-spinning';
            } else {
              viewportClass += ` tone-${item.tone || 'zero'}`;
            }

            const e1 = SPIN_EMOJIS[(spinTick + idx * 3) % SPIN_EMOJIS.length];
            const e2 = SPIN_EMOJIS[(spinTick + idx * 3 + 5) % SPIN_EMOJIS.length];
            const e3 = SPIN_EMOJIS[(spinTick + idx * 3 + 9) % SPIN_EMOJIS.length];

            return (
              <div className="reel-column" key={idx}>
                <div className="reel-step-label">{REEL_TITLES[idx]}</div>
                <div className={viewportClass}>
                  {isReelSpinning ? (
                    <div className="reel-spin-blur">
                      <span className="reel-spin-emoji">{e1}</span>
                      <span className="reel-spin-emoji">{e2}</span>
                      <span className="reel-spin-emoji">{e3}</span>
                    </div>
                  ) : (
                    <motion.div
                      key={`${idx}-${item.icon}-${item.label}-${isJustStopped ? 'land' : 'idle'}`}
                      className="reel-card"
                      initial={isJustStopped ? { y: -26, scale: 0.9, opacity: 0.6 } : false}
                      animate={{ y: 0, scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                    >
                      <div className="reel-icon">{item.icon}</div>
                      <div className="reel-label">{item.label}</div>
                      <div className="reel-sub">{item.sub}</div>
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* คันโยกที่จับลากลงได้จริงด้วย Framer Motion */}
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
              <span>{isSpinning ? '✨' : '🍒'}</span>
            </motion.div>
          </div>

          <div className="lever-hint">
            {isSpinning ? 'กำลังหมุน...' : isDraggingLever ? 'ปล่อยเพื่อปั่น!' : 'ลากลง ↓\nหรือคลิก'}
          </div>
        </div>
      </div>

      {/* ปุ่มกดถนัดมือสำหรับหน้าจอมือถือ */}
      <div className="mobile-spin-row">
        <motion.button
          type="button"
          className="btn-spin-main"
          onClick={handleAutoPull}
          disabled={!canPull}
          whileTap={canPull ? { scale: 0.95 } : undefined}
        >
          {isSpinning ? '🎰 กำลังหมุนวงล้อชะตา...' : '🍒 โยกคันโยกปั่นสล็อต!'}
        </motion.button>
      </div>
    </motion.section>
  );
}