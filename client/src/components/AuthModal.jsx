import React, { useEffect, useMemo, useState } from 'react';
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
  CheckCircle2
} from 'lucide-react';
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

  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!isOpen) return;
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
    setFeedback({ type: '', text: '' });
  }, [isOpen]);

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
    return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f3e7d8`;
  }, [regAvatar, regName]);

  const handleRefresh = async () => {
    if (!onRefreshPlayers || refreshing) return;
    setRefreshing(true);
    await onRefreshPlayers();
    setRefreshing(false);
  };

  const handlePickPlayer = (player) => {
    if (isBotPlayer(player)) return;
    setSelectedPlayer(player);
    setPin('');
    setConfirmPin('');
    setFeedback({ type: '', text: '' });
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlayer || submitting) return;

    const cleanPin = pin.replace(/\D/g, '').slice(0, 4);
    if (!/^\d{4}$/.test(cleanPin)) {
      setFeedback({ type: 'err', text: 'กรุณากรอกรหัส PIN ตัวเลข 4 หลักให้ครบค่ะ' });
      return;
    }

    if (selectedPlayer.hasPin) {
      setSubmitting(true);
      setFeedback({ type: 'wait', text: 'กำลังตรวจสอบรหัสผ่าน...' });
      const res = await postCasinoJson('/verify-pin', {
        userId: selectedPlayer.userId,
        pin: cleanPin
      });
      setSubmitting(false);

      if (!res.ok) {
        setFeedback({ type: 'err', text: res.error || 'ตรวจสอบรหัสไม่สำเร็จ กรุณาลองใหม่ค่ะ' });
        return;
      }
      if (!res.valid) {
        setFeedback({ type: 'err', text: 'รหัสผ่าน 4 หลักไม่ถูกต้อง ลองใหม่อีกครั้งนะคะ' });
        setPin('');
        return;
      }

      onAuthenticated?.({ ...selectedPlayer, hasPin: true }, cleanPin);
      return;
    }

    const cleanConfirm = confirmPin.replace(/\D/g, '').slice(0, 4);
    if (cleanPin !== cleanConfirm) {
      setFeedback({ type: 'err', text: 'รหัส PIN ทั้งสองช่องไม่ตรงกันค่ะ' });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: 'wait', text: 'กำลังบันทึกรหัส PIN ใหม่...' });
    const res = await postCasinoJson('/set-pin', {
      userId: selectedPlayer.userId,
      pin: cleanPin,
      confirmPin: cleanConfirm
    });
    setSubmitting(false);

    if (!res.ok) {
      setFeedback({ type: 'err', text: res.error || 'ไม่สามารถตั้งรหัสผ่านได้ในขณะนี้ค่ะ' });
      return;
    }

    onAuthenticated?.({ ...selectedPlayer, hasPin: true }, cleanPin);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const cleanName = regName.trim().replace(/\s+/g, ' ');
    const cleanPin = regPin.replace(/\D/g, '').slice(0, 4);
    const cleanConfirm = regConfirmPin.replace(/\D/g, '').slice(0, 4);

    if (cleanName.length < 2 || cleanName.length > 24) {
      setFeedback({ type: 'err', text: 'กรุณาตั้งชื่อความยาว 2 ถึง 24 ตัวอักษรค่ะ' });
      return;
    }
    if (!/^\d{4}$/.test(cleanPin) || cleanPin !== cleanConfirm) {
      setFeedback({ type: 'err', text: 'กรุณาตั้งรหัส PIN ตัวเลข 4 หลักและยืนยันให้ตรงกันค่ะ' });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: 'wait', text: 'กำลังเปิดบัญชีสมาชิกใหม่...' });
    const res = await postCasinoJson('/register', {
      displayName: cleanName,
      pin: cleanPin,
      confirmPin: cleanConfirm,
      avatarUrl: regAvatar.trim() || undefined
    });
    setSubmitting(false);

    if (!res.ok || !res.player) {
      setFeedback({ type: 'err', text: res.error || 'ไม่สามารถสร้างบัญชีได้ในขณะนี้ค่ะ' });
      return;
    }

    onAuthenticated?.({ ...res.player, hasPin: true }, cleanPin);
  };

  return (
    <PopModal
      isOpen={isOpen}
      onClose={onClose}
      canClose={canClose}
      cardClassName="auth-modal-card"
      cardStyle={{ maxWidth: 520 }}
    >
      <div className="modal-header">
        <div>
          <div className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {tab === 'REGISTER' ? <UserPlus {...ICON_BASE} size={18} /> : <UserRound {...ICON_BASE} size={18} />}
            <AnimatedText
              key={tab}
              text={tab === 'REGISTER' ? 'สมัครสมาชิก Horizon Cafe' : 'เลือกผู้เล่น & ยืนยันตัวตน'}
              variant="pop"
              by="word"
              stagger={0.03}
            />
          </div>
          <div className="modal-sub">
            {tab === 'REGISTER'
              ? 'สร้างบัญชีหน้าเว็บพร้อมรหัส PIN 4 หลักเพื่อเริ่มปั่นสล็อตได้ทันที'
              : 'เลือกรายชื่อของคุณเพื่อเข้าสู่ระบบด้วยรหัส PIN 4 หลัก'}
          </div>
        </div>
        {canClose && (
          <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
            <X {...ICON_BASE} size={16} />
          </button>
        )}
      </div>

      {/* แท็บสลับเข้าสู่ระบบ / สมัครสมาชิก */}
      <div className="lb-filter-tabs" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {[
          { id: 'LOGIN', label: 'เลือกบัญชีเดิม', Icon: UserRound },
          { id: 'REGISTER', label: 'สมัครสมาชิกใหม่', Icon: UserPlus }
        ].map((item) => {
          const TabIcon = item.Icon;
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`lb-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                setTab(item.id);
                setFeedback({ type: '', text: '' });
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="auth-tab-pill"
                  className="lb-tab-pill-bg"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <TabIcon {...ICON_BASE} size={13} />
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'LOGIN' ? (
          selectedPlayer ? (
            /* ขั้นตอนที่ 2: กรอกหรือตั้งรหัส PIN 4 หลัก */
            <motion.form
              key={`pin-${selectedPlayer.userId}`}
              onSubmit={handlePinSubmit}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 11 }}
            >
              <button
                type="button"
                className="btn-pill"
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={() => {
                  setSelectedPlayer(null);
                  setPin('');
                  setConfirmPin('');
                  setFeedback({ type: '', text: '' });
                }}
              >
                <ArrowLeft {...ICON_BASE} size={14} /> กลับไปเลือกรายชื่ออื่น
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 13px',
                  borderRadius: 16,
                  background: 'var(--surface-warm)',
                  border: '1.5px solid var(--border-caramel)'
                }}
              >
                <img
                  src={selectedPlayer.avatar || DEFAULT_AVATAR}
                  alt={selectedPlayer.displayName}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--border-caramel)',
                    flexShrink: 0
                  }}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      color: 'var(--espresso)'
                    }}
                  >
                    <span>{selectedPlayer.displayName}</span>
                    <AccountBadge type={selectedPlayer.accountType} />
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: '0.74rem',
                      color: 'var(--mocha-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Wallet {...ICON_BASE} size={12} /> {Number(selectedPlayer.walletBalance || 0).toLocaleString()}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Landmark {...ICON_BASE} size={12} /> {Number(selectedPlayer.bankBalance || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--cinnamon)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                {selectedPlayer.hasPin ? (
                  <>
                    <KeyRound {...ICON_BASE} size={15} /> กรอกรหัส PIN 4 หลักเพื่อเข้าสู่ระบบ
                  </>
                ) : (
                  <>
                    <ShieldCheck {...ICON_BASE} size={15} /> บัญชีนี้ยังไม่เคยตั้งรหัส กรุณาตั้ง PIN 4 หลักครั้งแรก
                  </>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  className="auth-input-text"
                  style={{ width: '100%', paddingRight: 42, letterSpacing: '0.32em', fontWeight: 800 }}
                  placeholder="••••"
                  value={pin}
                  disabled={submitting}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    if (feedback.type) setFeedback({ type: '', text: '' });
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--mocha-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    padding: 4
                  }}
                >
                  {showPin ? <EyeOff {...ICON_BASE} size={16} /> : <Eye {...ICON_BASE} size={16} />}
                </button>
              </div>

              {!selectedPlayer.hasPin && (
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  className="auth-input-text"
                  style={{ width: '100%', letterSpacing: '0.32em', fontWeight: 800 }}
                  placeholder="ยืนยัน PIN 4 หลักอีกครั้ง"
                  value={confirmPin}
                  disabled={submitting}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    if (feedback.type) setFeedback({ type: '', text: '' });
                  }}
                />
              )}

              {feedback.text && <div className={`pin-feedback ${feedback.type}`}>{feedback.text}</div>}

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                disabled={submitting || pin.length < 4 || (!selectedPlayer.hasPin && confirmPin.length < 4)}
              >
                <CheckCircle2 {...ICON_BASE} size={16} />
                <span>
                  {submitting
                    ? 'กำลังตรวจสอบ...'
                    : selectedPlayer.hasPin
                      ? 'ยืนยันเข้าสู่ระบบ'
                      : 'บันทึกรหัส PIN และเข้าเล่นเลย'}
                </span>
              </button>
            </motion.form>
          ) : (
            /* ขั้นตอนที่ 1: เลือกรายชื่อสมาชิก (เลื่อนใน .modal-body ชั้นเดียว ไม่มี Nested Scroll) */
            <motion.div
              key="picker"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 9 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <Search
                    {...ICON_BASE}
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 11,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--mocha-muted)',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    type="text"
                    className="picker-search"
                    style={{ width: '100%', paddingLeft: 32 }}
                    placeholder="ค้นหาชื่อสมาชิกในคาเฟ่..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-pill"
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
                    <RefreshCw {...ICON_BASE} size={14} />
                  </motion.span>
                </button>
              </div>

              {loadingPlayers && players.length === 0 ? (
                <div className="statement-empty">กำลังโหลดรายชื่อสมาชิกจากคาเฟ่...</div>
              ) : filteredPlayers.length === 0 ? (
                <div className="statement-empty">
                  ไม่พบรายชื่อที่ค้นหาค่ะ สามารถกดแท็บ "สมัครสมาชิกใหม่" เพื่อสร้างบัญชีเว็บได้ทันที
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {filteredPlayers.map((p, idx) => {
                    const isBot = isBotPlayer(p);
                    const isCurrent = activePlayer?.userId === p.userId;

                    return (
                      <PopItem key={p.userId} index={idx} step={0.028} maxStagger={12}>
                        <button
                          type="button"
                          disabled={isBot}
                          onClick={() => handlePickPlayer(p)}
                          className={`auth-player-item-btn ${isCurrent ? 'is-current' : ''}`}
                        >
                          <img
                            src={p.avatar || DEFAULT_AVATAR}
                            alt={p.displayName}
                            loading="lazy"
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid var(--border-caramel)',
                              flexShrink: 0
                            }}
                            onError={(e) => {
                              e.currentTarget.src = DEFAULT_AVATAR;
                            }}
                          />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                flexWrap: 'wrap',
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                color: 'var(--espresso)'
                              }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.displayName}
                              </span>
                              <AccountBadge type={p.accountType} />
                            </div>

                            <div
                              style={{
                                marginTop: 2,
                                fontSize: '0.7rem',
                                color: 'var(--mocha-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap'
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Wallet {...ICON_BASE} size={11} /> {Number(p.walletBalance || 0).toLocaleString()}
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Landmark {...ICON_BASE} size={11} /> {Number(p.bankBalance || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 999,
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              background: isBot
                                ? '#efe8e1'
                                : p.hasPin
                                  ? '#eaf6ef'
                                  : '#fff3dc',
                              color: isBot
                                ? 'var(--mocha-muted)'
                                : p.hasPin
                                  ? '#1f6b41'
                                  : '#9c5a08'
                            }}
                          >
                            {isBot ? (
                              <>
                                <Bot {...ICON_BASE} size={12} /> อัตโนมัติ
                              </>
                            ) : p.hasPin ? (
                              <>
                                <Lock {...ICON_BASE} size={12} /> มี PIN
                              </>
                            ) : (
                              <>
                                <LockOpen {...ICON_BASE} size={12} /> ตั้ง PIN ใหม่
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
          /* แท็บสมัครสมาชิกใหม่จากหน้าเว็บ */
          <motion.form
            key="register"
            onSubmit={handleRegisterSubmit}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 16,
                background: 'var(--surface-warm)',
                border: '1.5px solid var(--border-cream)'
              }}
            >
              <img
                src={previewRegAvatar}
                alt="ตัวอย่างอวาตาร์"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--border-caramel)',
                  background: '#fffdf9',
                  flexShrink: 0
                }}
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--mocha-muted)', lineHeight: 1.4 }}>
                <strong style={{ color: 'var(--espresso)', display: 'block', marginBottom: 2 }}>
                  อวาตาร์ประจำตัวอัตโนมัติ
                </strong>
                เปลี่ยนตามชื่อที่ตั้งทันที หรือวางลิงก์รูปภาพ https://... ด้านล่างได้ค่ะ
              </div>
            </div>

            <input
              type="text"
              maxLength={24}
              className="auth-input-text"
              placeholder="ตั้งชื่อแสดงในคาเฟ่ (2–24 ตัวอักษร)"
              value={regName}
              disabled={submitting}
              onChange={(e) => {
                setRegName(e.target.value);
                if (feedback.type) setFeedback({ type: '', text: '' });
              }}
            />

            <input
              type="url"
              className="auth-input-text"
              placeholder="ลิงก์รูปโปรไฟล์ https://... (เว้นว่างได้)"
              value={regAvatar}
              disabled={submitting}
              onChange={(e) => setRegAvatar(e.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="auth-input-text"
                style={{ letterSpacing: '0.25em', fontWeight: 800 }}
                placeholder="ตั้ง PIN 4 หลัก"
                value={regPin}
                disabled={submitting}
                onChange={(e) => {
                  setRegPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  if (feedback.type) setFeedback({ type: '', text: '' });
                }}
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="auth-input-text"
                style={{ letterSpacing: '0.25em', fontWeight: 800 }}
                placeholder="ยืนยัน PIN"
                value={regConfirmPin}
                disabled={submitting}
                onChange={(e) => {
                  setRegConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  if (feedback.type) setFeedback({ type: '', text: '' });
                }}
              />
            </div>

            {feedback.text && <div className={`pin-feedback ${feedback.type}`}>{feedback.text}</div>}

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              disabled={submitting || regName.trim().length < 2 || regPin.length < 4 || regConfirmPin.length < 4}
            >
              <Sparkles {...ICON_BASE} size={15} />
              <span>{submitting ? 'กำลังสร้างบัญชี...' : 'เปิดบัญชีสมาชิกและเข้าเล่นเลย'}</span>
            </button>
          </motion.form>
        )}
      </div>
    </PopModal>
  );
}