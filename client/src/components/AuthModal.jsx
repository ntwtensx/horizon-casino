import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserRound,
  UserPlus,
  Search,
  RefreshCw,
  X,
  Lock,
  LockOpen,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  MessageCircle,
  Globe,
  Bot,
  Wallet,
  Landmark,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react';
import '../styles/auth.css';
import { AnimatedText, PopModal, PopItem, ICON_BASE } from './MotionPrimitives.jsx';

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
const API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '');

async function postCasinoJson(path, body) {
  try {
    const res = await fetch(`${API_BASE}/api/casino${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return data;
  } catch {
    return { ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่ค่ะ' };
  }
}

function isBotPlayer(p) {
  return Boolean(p?.accountType === 'bot' || String(p?.userId || '').startsWith('bot_'));
}

function AccountBadge({ type }) {
  if (type === 'bot') {
    return (
      <span className="account-type-tag bot" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <Bot {...ICON_BASE} size={11} /> บอท
      </span>
    );
  }
  if (type === 'web') {
    return (
      <span className="account-type-tag web" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <Globe {...ICON_BASE} size={11} /> เว็บ
      </span>
    );
  }
  return (
    <span className="account-type-tag discord" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <MessageCircle {...ICON_BASE} size={11} /> Discord
    </span>
  );
}

/**
 * 🔢 ช่องกรอก PIN 4 หลักแบบ Smart Vault
 * - กดพิมพ์/วาง/ลบต่อเนื่องผ่าน input ล่องหนที่คลุมทั้ง 4 ช่อง (ไม่หลุดโฟกัสบนมือถือ)
 * - มีแอนิเมชันเด้งทีละหลัก, คลื่นตรวจสอบ (checking), แฟลชสำเร็จ (success) และสั่นเตือน (error)
 */
function SmartPinBoxes({
  label,
  value = '',
  onChange,
  status = 'idle', // idle | checking | success | error
  showDigits = false,
  disabled = false,
  autoFocus = false,
  compact = false,
  inputRef,
  shakeKey = 0
}) {
  const internalRef = useRef(null);
  const resolvedRef = inputRef || internalRef;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const tid = setTimeout(() => {
      resolvedRef.current?.focus?.();
    }, 120);
    return () => clearTimeout(tid);
  }, [autoFocus, disabled, resolvedRef]);

  const activeIdx = Math.min(value.length, 3);

  return (
    <div className="smart-pin-block">
      {label && <span className="smart-pin-label">{label}</span>}

      <motion.div
        key={status === 'error' ? `shake-${shakeKey}` : 'tray'}
        className="smart-pin-tray"
        animate={
          status === 'error'
            ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.42, ease: 'easeInOut' }}
        onClick={() => {
          if (!disabled) resolvedRef.current?.focus?.();
        }}
      >
        <input
          ref={resolvedRef}
          type="tel"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          className="smart-pin-hidden-input"
          aria-label={label || 'กรอกรหัส PIN 4 หลัก'}
          value={value}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
            onChange?.(cleaned);
          }}
        />

        {[0, 1, 2, 3].map((idx) => {
          const digit = value[idx] || '';
          const isFilled = Boolean(digit);
          const isActive = focused && !disabled && status === 'idle' && idx === activeIdx && !isFilled;

          const slotCls = [
            'smart-pin-slot',
            compact ? 'is-compact' : '',
            isActive ? 'is-active' : '',
            isFilled ? 'is-filled' : '',
            status === 'checking' ? 'is-checking' : '',
            status === 'success' ? 'is-success' : '',
            status === 'error' ? 'is-error' : ''
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <motion.div
              key={idx}
              className={slotCls}
              animate={
                status === 'checking'
                  ? { y: [0, -7, 0], scale: [1, 1.07, 1] }
                  : status === 'success'
                    ? { scale: [1, 1.12, 1], y: 0 }
                    : isFilled
                      ? { scale: [0.88, 1.08, 1], y: 0 }
                      : { scale: 1, y: 0 }
              }
              transition={
                status === 'checking'
                  ? { repeat: Infinity, duration: 0.72, delay: idx * 0.11, ease: 'easeInOut' }
                  : { type: 'spring', stiffness: 460, damping: 22, delay: status === 'success' ? idx * 0.05 : 0 }
              }
            >
              {isFilled ? (
                showDigits ? (
                  <motion.span
                    key={`d-${idx}-${digit}`}
                    className="smart-pin-digit"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  >
                    {digit}
                  </motion.span>
                ) : (
                  <motion.span
                    key={`dot-${idx}`}
                    className="smart-pin-dot"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                  />
                )
              ) : isActive ? (
                <span className="smart-pin-caret" aria-hidden="true" />
              ) : null}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

export default function AuthModal({
  isOpen,
  canClose = false,
  loadingPlayers = false,
  players = [],
  activePlayer = null,
  onClose,
  onRefreshPlayers,
  onAuthenticated
}) {
  const [tab, setTab] = useState('LOGIN'); // LOGIN | REGISTER
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [regName, setRegName] = useState('');
  const [regAvatar, setRegAvatar] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);

  // สถานะโปรเซสตรวจสอบ: idle | checking | success | error
  const [verifyState, setVerifyState] = useState('idle');
  const [statusText, setStatusText] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loginPinRef = useRef(null);
  const loginConfirmRef = useRef(null);
  const regPinRef = useRef(null);
  const regConfirmRef = useRef(null);
  const timersRef = useRef([]);

  const clearAuthTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => clearAuthTimers();
  }, [clearAuthTimers]);

  useEffect(() => {
    if (!isOpen) {
      clearAuthTimers();
      return;
    }
    setTab('LOGIN');
    setSearch('');
    setSelectedPlayer(null);
    setPin('');
    setConfirmPin('');
    setShowPin(false);
    setRegName('');
    setRegAvatar('');
    setRegPin('');
    setRegConfirmPin('');
    setShowRegPin(false);
    setVerifyState('idle');
    setStatusText('');
  }, [isOpen, clearAuthTimers]);

  const filteredPlayers = useMemo(() => {
    const kw = search.trim().toLowerCase();
    const list = (players || []).filter((p) => {
      if (!kw) return true;
      return `${p.displayName || ''} ${p.nickname || ''} ${p.username || ''}`
        .toLowerCase()
        .includes(kw);
    });
    return [...list].sort((a, b) => {
      const botDiff = Number(isBotPlayer(a)) - Number(isBotPlayer(b));
      if (botDiff !== 0) return botDiff;
      return (a.displayName || '').localeCompare(b.displayName || '', 'th');
    });
  }, [players, search]);

  const previewRegAvatar = useMemo(() => {
    const trimmed = regAvatar.trim();
    if (/^https:\/\/[^\s"'<>]+$/i.test(trimmed)) return trimmed;
    const seed = regName.trim() || 'HorizonGuest';
    return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f3ebff`;
  }, [regAvatar, regName]);

  const isBusy = verifyState === 'checking' || verifyState === 'success';

  const handleRefresh = async () => {
    if (!onRefreshPlayers || refreshing) return;
    setRefreshing(true);
    await onRefreshPlayers();
    setRefreshing(false);
  };

  const handlePickPlayer = (player) => {
    if (isBotPlayer(player)) return;
    clearAuthTimers();
    setSelectedPlayer(player);
    setPin('');
    setConfirmPin('');
    setVerifyState('idle');
    setStatusText('');
  };

  // โปรเซสตรวจสอบรหัส PIN พร้อมจังหวะแอนิเมชันที่ดูสมูทและชัดเจน
  const runPinAuth = useCallback(
    async (targetPlayer, pinValue, confirmValue = '') => {
      if (!targetPlayer || verifyState === 'checking' || verifyState === 'success') return;
      const cleanPin = pinValue.replace(/\D/g, '').slice(0, 4);
      if (!/^\d{4}$/.test(cleanPin)) return;

      if (!targetPlayer.hasPin) {
        const cleanConfirm = confirmValue.replace(/\D/g, '').slice(0, 4);
        if (cleanPin !== cleanConfirm) {
          setVerifyState('error');
          setStatusText('รหัส PIN ทั้ง 2 ช่องไม่ตรงกัน ลองใหม่อีกครั้งนะคะ');
          setShakeKey((k) => k + 1);
          return;
        }
      }

      setVerifyState('checking');
      setStatusText(
        targetPlayer.hasPin
          ? 'กำลังตรวจสอบรหัสผ่านอย่างปลอดภัย...'
          : 'กำลังเข้ารหัสและบันทึก PIN ใหม่...'
      );

      const startedAt = Date.now();
      const res = targetPlayer.hasPin
        ? await postCasinoJson('/verify-pin', {
            userId: targetPlayer.userId,
            pin: cleanPin
          })
        : await postCasinoJson('/set-pin', {
            userId: targetPlayer.userId,
            pin: cleanPin,
            confirmPin: cleanPin
          });

      // ให้จังหวะคลื่นตรวจสอบแสดงอย่างน้อย 420ms เพื่อความสมูทไม่กระพริบหายเร็วเกินไป
      const minAnimGap = Math.max(0, 420 - (Date.now() - startedAt));

      scheduleTimer(() => {
        const failed = !res.ok || (targetPlayer.hasPin && !res.valid);
        if (failed) {
          setVerifyState('error');
          setShakeKey((k) => k + 1);
          setStatusText(
            !res.ok
              ? res.error || 'ตรวจสอบรหัสไม่สำเร็จ กรุณาลองใหม่ค่ะ'
              : 'รหัส PIN 4 หลักไม่ถูกต้อง ลองใหม่อีกครั้งนะคะ'
          );
          scheduleTimer(() => {
            if (targetPlayer.hasPin) {
              setPin('');
              loginPinRef.current?.focus?.();
            } else {
              setConfirmPin('');
              loginConfirmRef.current?.focus?.();
            }
          }, 420);
          return;
        }

        setVerifyState('success');
        setStatusText(
          `ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับคุณ${targetPlayer.nickname || targetPlayer.displayName}`
        );

        scheduleTimer(() => {
          onAuthenticated?.({ ...targetPlayer, hasPin: true }, cleanPin);
        }, 560);
      }, minAnimGap);
    },
    [verifyState, onAuthenticated, scheduleTimer]
  );

  // กดครบ 4 หลักบนบัญชีที่มี PIN แล้ว ➔ สั่งตรวจสอบอัตโนมัติทันที
  const handleLoginPinChange = (nextVal) => {
    setPin(nextVal);
    if (verifyState === 'error') {
      setVerifyState('idle');
      setStatusText('');
    }
    if (!selectedPlayer) return;

    if (nextVal.length === 4) {
      if (selectedPlayer.hasPin) {
        scheduleTimer(() => runPinAuth(selectedPlayer, nextVal), 130);
      } else {
        scheduleTimer(() => loginConfirmRef.current?.focus?.(), 100);
      }
    }
  };

  const handleLoginConfirmChange = (nextVal) => {
    setConfirmPin(nextVal);
    if (verifyState === 'error') {
      setVerifyState('idle');
      setStatusText('');
    }
    if (selectedPlayer && !selectedPlayer.hasPin && pin.length === 4 && nextVal.length === 4) {
      if (nextVal === pin) {
        scheduleTimer(() => runPinAuth(selectedPlayer, pin, nextVal), 140);
      } else {
        setVerifyState('error');
        setStatusText('รหัส PIN ยืนยันยังไม่ตรงกับช่องแรกค่ะ');
        setShakeKey((k) => k + 1);
      }
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (isBusy) return;

    const cleanName = regName.trim().replace(/\s+/g, ' ');
    const cleanPin = regPin.replace(/\D/g, '').slice(0, 4);
    const cleanConfirm = regConfirmPin.replace(/\D/g, '').slice(0, 4);

    if (cleanName.length < 2 || cleanName.length > 24) {
      setVerifyState('error');
      setStatusText('กรุณาตั้งชื่อความยาว 2 ถึง 24 ตัวอักษรค่ะ');
      return;
    }
    if (!/^\d{4}$/.test(cleanPin) || cleanPin !== cleanConfirm) {
      setVerifyState('error');
      setShakeKey((k) => k + 1);
      setStatusText('กรุณาตั้งรหัส PIN 4 หลักและยืนยันให้ตรงกันค่ะ');
      return;
    }

    setVerifyState('checking');
    setStatusText('กำลังสร้างบัญชีสมาชิกและตั้งค่าตู้เซฟ...');

    const startedAt = Date.now();
    const res = await postCasinoJson('/register', {
      displayName: cleanName,
      pin: cleanPin,
      confirmPin: cleanConfirm,
      avatarUrl: regAvatar.trim() || undefined
    });

    const minAnimGap = Math.max(0, 450 - (Date.now() - startedAt));

    scheduleTimer(() => {
      if (!res.ok || !res.player) {
        setVerifyState('error');
        setShakeKey((k) => k + 1);
        setStatusText(res.error || 'ไม่สามารถสร้างบัญชีได้ในขณะนี้ค่ะ');
        return;
      }

      setVerifyState('success');
      setStatusText(`เปิดบัญชีสำเร็จ! ยินดีต้อนรับ ${res.player.displayName}`);
      scheduleTimer(() => {
        onAuthenticated?.({ ...res.player, hasPin: true }, cleanPin);
      }, 560);
    }, minAnimGap);
  };

  const switchTab = (nextTab) => {
    if (isBusy || nextTab === tab) return;
    clearAuthTimers();
    setTab(nextTab);
    setVerifyState('idle');
    setStatusText('');
  };

  const regPinMismatch = regPin.length === 4 && regConfirmPin.length === 4 && regPin !== regConfirmPin;
  const regPinMatched = regPin.length === 4 && regConfirmPin.length === 4 && regPin === regConfirmPin;

  return (
    <PopModal
      isOpen={isOpen}
      onClose={onClose}
      canClose={canClose && !isBusy}
      cardClassName="auth-modal-card"
    >
      {/* 🌸 ส่วนหัวพาสเทลฟลอรัล */}
      <div className="auth-hero-header">
        <div className="auth-hero-top">
          <div>
            <span className="auth-hero-badge">
              <Sparkles {...ICON_BASE} size={11} /> Horizon Cafe Member Pass
            </span>
            <h2 className="auth-hero-title">
              {tab === 'REGISTER' ? (
                <UserPlus {...ICON_BASE} size={19} />
              ) : selectedPlayer ? (
                <KeyRound {...ICON_BASE} size={19} />
              ) : (
                <UserRound {...ICON_BASE} size={19} />
              )}
              <AnimatedText
                key={`${tab}-${selectedPlayer ? 'pin' : 'list'}`}
                text={
                  tab === 'REGISTER'
                    ? 'เปิดบัญชีสมาชิกใหม่'
                    : selectedPlayer
                      ? 'ปลดล็อกตู้เซฟส่วนตัว'
                      : 'เลือกผู้เล่นเข้าสู่คาเฟ่'
                }
                variant="pop"
                by="word"
                stagger={0.03}
              />
            </h2>
            <p className="auth-hero-sub">
              {tab === 'REGISTER'
                ? 'สร้างชื่อและรหัส PIN 4 หลักเพื่อเริ่มปั่นสล็อตได้ทันที'
                : selectedPlayer
                  ? 'กรอกรหัส PIN 4 หลัก ระบบจะตรวจสอบให้อัตโนมัติทันที'
                  : 'เลือกรายชื่อสมาชิกของคุณเพื่อยืนยันตัวตนเข้าสู่ระบบ'}
            </p>
          </div>

          {canClose && (
            <button
              type="button"
              className="auth-close-btn"
              onClick={onClose}
              disabled={isBusy}
              aria-label="ปิดหน้าต่าง"
            >
              <X {...ICON_BASE} size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 🎛️ แถบสลับแท็บ Pill Slider คงที่ 50% เลื่อนสมูทไม่เด้ง */}
      <div className="auth-segment-wrap">
        <div className="auth-segment-track" role="tablist" aria-label="สลับโหมดเข้าสู่ระบบ">
          <motion.div
            className="auth-segment-slider"
            initial={false}
            animate={{ x: tab === 'LOGIN' ? '0%' : '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'LOGIN'}
            className={`auth-segment-btn ${tab === 'LOGIN' ? 'is-active' : ''}`}
            onClick={() => switchTab('LOGIN')}
            disabled={isBusy}
          >
            <UserRound {...ICON_BASE} size={14} />
            <span>เลือกบัญชีเดิม</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'REGISTER'}
            className={`auth-segment-btn ${tab === 'REGISTER' ? 'is-active' : ''}`}
            onClick={() => switchTab('REGISTER')}
            disabled={isBusy}
          >
            <UserPlus {...ICON_BASE} size={14} />
            <span>สมัครสมาชิกใหม่</span>
          </button>
        </div>
      </div>

      {/* 📜 พื้นที่เนื้อหาเลื่อนภายในความสูงคงที่ */}
      <div className="auth-body-viewport">
        {tab === 'LOGIN' ? (
          selectedPlayer ? (
            /* ขั้นตอนที่ 2: Smart PIN Vault */
            <motion.form
              key={`vault-${selectedPlayer.userId}`}
              className="auth-pin-stage"
              onSubmit={(e) => {
                e.preventDefault();
                runPinAuth(selectedPlayer, pin, confirmPin);
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="auth-back-row">
                <button
                  type="button"
                  className="auth-ghost-btn"
                  disabled={isBusy}
                  onClick={() => {
                    clearAuthTimers();
                    setSelectedPlayer(null);
                    setPin('');
                    setConfirmPin('');
                    setVerifyState('idle');
                    setStatusText('');
                  }}
                >
                  <ArrowLeft {...ICON_BASE} size={13} /> เปลี่ยนรายชื่อ
                </button>

                <button
                  type="button"
                  className="auth-ghost-btn"
                  disabled={isBusy}
                  onClick={() => setShowPin((v) => !v)}
                >
                  {showPin ? <EyeOff {...ICON_BASE} size={13} /> : <Eye {...ICON_BASE} size={13} />}
                  <span>{showPin ? 'ซ่อนตัวเลข' : 'แสดงตัวเลข'}</span>
                </button>
              </div>

              {/* อวาตาร์พร้อมวงแหวนแอนิเมชันตามสถานะตรวจสอบ */}
              <div className="auth-vault-profile">
                <motion.div
                  className={`auth-avatar-halo status-${verifyState}`}
                  animate={verifyState === 'success' ? { scale: [1, 1.09, 1] } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                >
                  <img
                    className="auth-avatar-halo-img"
                    src={selectedPlayer.avatar || DEFAULT_AVATAR}
                    alt={selectedPlayer.displayName}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <motion.span
                    key={verifyState}
                    className={`auth-avatar-status-badge ${verifyState}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 20 }}
                  >
                    {verifyState === 'checking' ? (
                      <Loader2 {...ICON_BASE} size={13} className="auth-spin-icon" />
                    ) : verifyState === 'success' ? (
                      <Check {...ICON_BASE} size={14} />
                    ) : verifyState === 'error' ? (
                      <AlertCircle {...ICON_BASE} size={14} />
                    ) : selectedPlayer.hasPin ? (
                      <Lock {...ICON_BASE} size={12} />
                    ) : (
                      <ShieldCheck {...ICON_BASE} size={13} />
                    )}
                  </motion.span>
                </motion.div>

                <div className="auth-vault-name">
                  <span>{selectedPlayer.displayName}</span>
                  <AccountBadge type={selectedPlayer.accountType} />
                </div>

                <div className="auth-vault-hint">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Wallet {...ICON_BASE} size={12} /> {Number(selectedPlayer.walletBalance || 0).toLocaleString()}
                  </span>
                  <span>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Landmark {...ICON_BASE} size={12} /> {Number(selectedPlayer.bankBalance || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* ช่องใส่รหัส PIN 4 หลัก */}
              <SmartPinBoxes
                label={selectedPlayer.hasPin ? 'กรอกรหัส PIN 4 หลัก' : 'ตั้งรหัส PIN 4 หลักครั้งแรก'}
                value={pin}
                onChange={handleLoginPinChange}
                status={verifyState}
                showDigits={showPin}
                disabled={isBusy}
                autoFocus
                inputRef={loginPinRef}
                shakeKey={shakeKey}
              />

              {!selectedPlayer.hasPin && (
                <SmartPinBoxes
                  label="ยืนยันรหัส PIN 4 หลักอีกครั้ง"
                  value={confirmPin}
                  onChange={handleLoginConfirmChange}
                  status={verifyState}
                  showDigits={showPin}
                  disabled={isBusy}
                  compact
                  inputRef={loginConfirmRef}
                  shakeKey={shakeKey}
                />
              )}

              {/* แถบสถานะโปรเซสตรวจสอบ */}
              {statusText ? (
                <motion.div
                  key={`${verifyState}-${statusText}`}
                  className={`auth-status-banner ${verifyState === 'idle' ? 'info' : verifyState}`}
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18 }}
                >
                  {verifyState === 'checking' && <Loader2 {...ICON_BASE} size={15} className="auth-spin-icon" />}
                  {verifyState === 'success' && <CheckCircle2 {...ICON_BASE} size={15} />}
                  {verifyState === 'error' && <AlertCircle {...ICON_BASE} size={15} />}
                  <span>{statusText}</span>
                </motion.div>
              ) : (
                <div className="auth-status-banner info">
                  <KeyRound {...ICON_BASE} size={14} />
                  <span>
                    {selectedPlayer.hasPin
                      ? 'แตะที่ช่องแล้วพิมพ์ตัวเลข 4 หลักเพื่อปลดล็อกทันที'
                      : 'ตั้งตัวเลข 4 หลักทั้ง 2 ช่องให้ตรงกันเพื่อเปิดใช้งาน'}
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="auth-smart-btn"
                disabled={isBusy || pin.length < 4 || (!selectedPlayer.hasPin && confirmPin.length < 4)}
              >
                {verifyState === 'checking' ? (
                  <>
                    <Loader2 {...ICON_BASE} size={16} className="auth-spin-icon" />
                    <span>กำลังตรวจสอบรหัส...</span>
                  </>
                ) : verifyState === 'success' ? (
                  <>
                    <CheckCircle2 {...ICON_BASE} size={16} />
                    <span>เข้าสู่ระบบสำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck {...ICON_BASE} size={16} />
                    <span>{selectedPlayer.hasPin ? 'ยืนยันรหัส PIN' : 'บันทึกรหัสและเข้าเล่นเลย'}</span>
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            /* ขั้นตอนที่ 1: เลือกรายชื่อสมาชิก */
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="auth-search-bar">
                <div className="auth-search-field">
                  <Search {...ICON_BASE} size={15} className="auth-search-icon" />
                  <input
                    type="text"
                    className="auth-input-modern has-icon"
                    placeholder="ค้นหาชื่อสมาชิกในคาเฟ่..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="auth-icon-btn"
                  onClick={handleRefresh}
                  disabled={refreshing || loadingPlayers}
                  aria-label="รีเฟรชรายชื่อสมาชิก"
                >
                  <motion.span
                    animate={refreshing || loadingPlayers ? { rotate: 360 } : { rotate: 0 }}
                    transition={
                      refreshing || loadingPlayers
                        ? { repeat: Infinity, duration: 0.75, ease: 'linear' }
                        : { duration: 0.2 }
                    }
                    style={{ display: 'inline-flex', alignItems: 'center' }}
                  >
                    <RefreshCw {...ICON_BASE} size={15} />
                  </motion.span>
                </button>
              </div>

              {loadingPlayers && players.length === 0 ? (
                <div className="statement-empty">กำลังโหลดรายชื่อสมาชิกจากคาเฟ่...</div>
              ) : filteredPlayers.length === 0 ? (
                <div className="statement-empty">
                  ไม่พบรายชื่อที่ค้นหาค่ะ กดแท็บ "สมัครสมาชิกใหม่" ด้านบนเพื่อสร้างบัญชีได้ทันที
                </div>
              ) : (
                <div className="auth-player-list">
                  {filteredPlayers.map((p, idx) => {
                    const isBot = isBotPlayer(p);
                    const isCurrent = activePlayer?.userId === p.userId;

                    return (
                      <PopItem key={p.userId} index={idx} step={0.024} maxStagger={10}>
                        <button
                          type="button"
                          disabled={isBot}
                          onClick={() => handlePickPlayer(p)}
                          className={`auth-player-card ${isCurrent ? 'is-current' : ''}`}
                        >
                          <img
                            className="auth-player-avatar"
                            src={p.avatar || DEFAULT_AVATAR}
                            alt={p.displayName}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.src = DEFAULT_AVATAR;
                            }}
                          />

                          <div className="auth-player-meta">
                            <div className="auth-player-name">
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.displayName}
                              </span>
                              <AccountBadge type={p.accountType} />
                            </div>
                            <div className="auth-player-stats">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Wallet {...ICON_BASE} size={11} /> {Number(p.walletBalance || 0).toLocaleString()}
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Landmark {...ICON_BASE} size={11} /> {Number(p.bankBalance || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`auth-pin-pill ${
                              isBot ? 'is-bot' : p.hasPin ? 'has-pin' : 'new-pin'
                            }`}
                          >
                            {isBot ? (
                              <>
                                <Bot {...ICON_BASE} size={12} /> อัตโนมัติ
                              </>
                            ) : p.hasPin ? (
                              <>
                                <Lock {...ICON_BASE} size={11} /> มี PIN
                              </>
                            ) : (
                              <>
                                <LockOpen {...ICON_BASE} size={11} /> ตั้งใหม่
                              </>
                            )}
                          </span>
                        </button>
                      </PopItem>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )
        ) : (
          /* แท็บสมัครสมาชิกใหม่ */
          <motion.form
            key="register"
            className="auth-register-form"
            onSubmit={handleRegisterSubmit}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="auth-avatar-preview-card">
              <div className="auth-avatar-preview-ring">
                <img
                  src={previewRegAvatar}
                  alt="ตัวอย่างอวาตาร์"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
              </div>
              <div style={{ fontSize: '0.74rem', color: '#6f5b87', lineHeight: 1.42 }}>
                <strong style={{ color: '#3d2c54', display: 'block', marginBottom: 2, fontSize: '0.82rem' }}>
                  อวาตาร์ประจำตัวอัตโนมัติ
                </strong>
                เปลี่ยนตามชื่อที่ตั้งทันที หรือวางลิงก์รูป https://... ด้านล่างได้ค่ะ
              </div>
            </div>

            <input
              type="text"
              maxLength={24}
              className="auth-input-modern"
              placeholder="ตั้งชื่อแสดงในคาเฟ่ (2–24 ตัวอักษร)"
              value={regName}
              disabled={isBusy}
              onChange={(e) => {
                setRegName(e.target.value);
                if (verifyState === 'error') {
                  setVerifyState('idle');
                  setStatusText('');
                }
              }}
            />

            <input
              type="url"
              className="auth-input-modern"
              placeholder="ลิงก์รูปโปรไฟล์ https://... (เว้นว่างได้)"
              value={regAvatar}
              disabled={isBusy}
              onChange={(e) => setRegAvatar(e.target.value)}
            />

            <div className="auth-reg-pin-grid">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="auth-ghost-btn"
                  disabled={isBusy}
                  onClick={() => setShowRegPin((v) => !v)}
                >
                  {showRegPin ? <EyeOff {...ICON_BASE} size={12} /> : <Eye {...ICON_BASE} size={12} />}
                  <span>{showRegPin ? 'ซ่อน PIN' : 'ดู PIN'}</span>
                </button>
              </div>

              <SmartPinBoxes
                label="ตั้งรหัส PIN 4 หลัก"
                value={regPin}
                onChange={(val) => {
                  setRegPin(val);
                  if (verifyState === 'error') {
                    setVerifyState('idle');
                    setStatusText('');
                  }
                  if (val.length === 4) {
                    scheduleTimer(() => regConfirmRef.current?.focus?.(), 90);
                  }
                }}
                status={regPinMismatch ? 'error' : verifyState}
                showDigits={showRegPin}
                disabled={isBusy}
                compact
                inputRef={regPinRef}
                shakeKey={shakeKey}
              />

              <SmartPinBoxes
                label="ยืนยันรหัส PIN อีกครั้ง"
                value={regConfirmPin}
                onChange={(val) => {
                  setRegConfirmPin(val);
                  if (verifyState === 'error') {
                    setVerifyState('idle');
                    setStatusText('');
                  }
                }}
                status={regPinMismatch ? 'error' : regPinMatched && verifyState === 'idle' ? 'success' : verifyState}
                showDigits={showRegPin}
                disabled={isBusy}
                compact
                inputRef={regConfirmRef}
                shakeKey={shakeKey}
              />

              {regPinMatched && verifyState === 'idle' && (
                <span className="auth-match-pill ok">
                  <Check {...ICON_BASE} size={12} /> รหัส PIN ตรงกันพร้อมเปิดบัญชี
                </span>
              )}
              {regPinMismatch && (
                <span className="auth-match-pill bad">
                  <AlertCircle {...ICON_BASE} size={12} /> รหัส PIN ทั้ง 2 ช่องยังไม่ตรงกัน
                </span>
              )}
            </div>

            {statusText && (
              <motion.div
                key={`${verifyState}-${statusText}`}
                className={`auth-status-banner ${verifyState === 'idle' ? 'info' : verifyState}`}
                style={{ maxWidth: '100%' }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {verifyState === 'checking' && <Loader2 {...ICON_BASE} size={15} className="auth-spin-icon" />}
                {verifyState === 'success' && <CheckCircle2 {...ICON_BASE} size={15} />}
                {verifyState === 'error' && <AlertCircle {...ICON_BASE} size={15} />}
                <span>{statusText}</span>
              </motion.div>
            )}

            <button
              type="submit"
              className="auth-smart-btn"
              disabled={isBusy || regName.trim().length < 2 || !regPinMatched}
            >
              {verifyState === 'checking' ? (
                <>
                  <Loader2 {...ICON_BASE} size={16} className="auth-spin-icon" />
                  <span>กำลังสร้างบัญชีสมาชิก...</span>
                </>
              ) : verifyState === 'success' ? (
                <>
                  <CheckCircle2 {...ICON_BASE} size={16} />
                  <span>เปิดบัญชีสำเร็จ!</span>
                </>
              ) : (
                <>
                  <Sparkles {...ICON_BASE} size={16} />
                  <span>เปิดบัญชีสมาชิกและเข้าเล่นเลย</span>
                </>
              )}
            </button>
          </motion.form>
        )}
      </div>
    </PopModal>
  );
}