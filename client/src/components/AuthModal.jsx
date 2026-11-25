import React, { useEffect, useRef, useState } from 'react';
import { casinoApi } from '../api';

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

function PinFourInputs({ digits, setDigits, stateClass, inputRefs, disabled }) {
  const handleChange = (idx, raw) => {
    const val = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    if (val && idx < 3) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      e.preventDefault();
      const next = [...digits];
      next[idx - 1] = '';
      setDigits(next);
      inputRefs.current[idx - 1]?.focus();
    }
  };

  return (
    <div className="pin-boxes">
      {[0, 1, 2, 3].map((idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el;
          }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          className={`pin-input ${stateClass}`}
          value={digits[idx]}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          autoComplete="off"
        />
      ))}
    </div>
  );
}

export default function AuthModal({
  isOpen,
  canClose,
  loadingPlayers,
  players,
  activePlayer,
  onClose,
  onRefreshPlayers,
  onAuthenticated
}) {
  const [dropdownOpen, setDropdownOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  // โหมดจัดการ PIN: IDLE | VERIFY | CREATE_1 | CREATE_2
  const [flowMode, setFlowMode] = useState('IDLE');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [firstDraft, setFirstDraft] = useState('');
  const [pinStatus, setPinStatus] = useState({ type: 'wait', text: '' });
  const [pinVerified, setPinVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pinRefs = useRef([]);

  const selectedPlayer = players.find((p) => p.userId === selectedId) || null;

  useEffect(() => {
    if (!isOpen) return;
    const initId = activePlayer?.userId || '';
    setSelectedId(initId);
    setDropdownOpen(!initId);
    setSearch('');
    setDigits(['', '', '', '']);
    setFirstDraft('');
    setPinVerified(false);
    const found = players.find((p) => p.userId === initId);
    if (found) {
      setFlowMode(found.hasPin ? 'VERIFY' : 'IDLE');
      setPinStatus({
        type: 'wait',
        text: found.hasPin ? '⌨️ กรอกรหัสผ่านตัวเลข 4 หลักเพื่อตรวจสอบ...' : ''
      });
    } else {
      setFlowMode('IDLE');
      setPinStatus({ type: 'wait', text: '' });
    }
  }, [isOpen, activePlayer, players]);

  useEffect(() => {
    if (!isOpen) return;
    if (flowMode === 'VERIFY' || flowMode === 'CREATE_1' || flowMode === 'CREATE_2') {
      const t = setTimeout(() => pinRefs.current[0]?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, flowMode, selectedId]);

  const pinValue = digits.join('');

  // ตรวจสอบ PIN อัตโนมัติเมื่อกรอกครบ 4 หลักในโหมด VERIFY
  useEffect(() => {
    if (flowMode !== 'VERIFY' || !selectedPlayer) return;
    if (pinValue.length < 4) {
      setPinVerified(false);
      setPinStatus({ type: 'wait', text: '⌨️ กรอกรหัสผ่านตัวเลข 4 หลักเพื่อตรวจสอบ...' });
      return;
    }

    let cancelled = false;
    setPinVerified(false);
    setPinStatus({ type: 'wait', text: '⏳ กำลังตรวจสอบรหัสผ่าน...' });

    casinoApi.verifyPin(selectedPlayer.userId, pinValue).then((res) => {
      if (cancelled) return;
      if (res.ok && res.valid) {
        setPinVerified(true);
        setPinStatus({ type: 'ok', text: '✅ รหัสถูกต้อง! กดปุ่มเข้าสู่คาสิโนได้เลยค่ะ' });
      } else {
        setPinVerified(false);
        setPinStatus({ type: 'err', text: '❌ รหัสผ่าน 4 หลักไม่ถูกต้อง กรุณาลองใหม่ค่ะ' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pinValue, flowMode, selectedPlayer]);

  if (!isOpen) return null;

  const filteredPlayers = players.filter((p) => {
    const kw = search.trim().toLowerCase();
    if (!kw) return true;
    return `${p.displayName} ${p.username} ${p.nickname || ''}`.toLowerCase().includes(kw);
  });

  const handleSelectUser = (player) => {
    setSelectedId(player.userId);
    setDropdownOpen(false);
    setDigits(['', '', '', '']);
    setFirstDraft('');
    setPinVerified(false);
    if (player.hasPin) {
      setFlowMode('VERIFY');
      setPinStatus({ type: 'wait', text: '⌨️ กรอกรหัสผ่านตัวเลข 4 หลักเพื่อตรวจสอบ...' });
    } else {
      setFlowMode('IDLE');
      setPinStatus({ type: 'wait', text: '' });
    }
  };

  const startCreatePin = () => {
    setFlowMode('CREATE_1');
    setFirstDraft('');
    setDigits(['', '', '', '']);
    setPinStatus({ type: 'wait', text: 'ตั้งตัวเลข 4 หลักสำหรับเข้าเล่นครั้งต่อไป' });
  };

  const goCreateRound2 = () => {
    if (pinValue.length !== 4) return;
    setFirstDraft(pinValue);
    setDigits(['', '', '', '']);
    setFlowMode('CREATE_2');
    setPinStatus({ type: 'wait', text: 'กรอกรหัส 4 หลักเดิมอีกครั้งเพื่อยืนยัน' });
  };

  const handleSaveNewPin = async () => {
    if (!selectedPlayer || pinValue.length !== 4 || pinValue !== firstDraft || submitting) return;
    setSubmitting(true);
    setPinStatus({ type: 'wait', text: '⏳ กำลังบันทึกรหัสผ่าน 4 หลัก...' });

    const res = await casinoApi.setPin(selectedPlayer.userId, firstDraft, pinValue);
    setSubmitting(false);

    if (!res.ok) {
      setPinStatus({ type: 'err', text: `⚠️ ${res.error || 'ไม่สามารถบันทึกรหัสได้'}` });
      return;
    }

    onAuthenticated({ ...selectedPlayer, hasPin: true }, pinValue);
  };

  const handleConfirmVerify = () => {
    if (!selectedPlayer || !pinVerified) return;
    onAuthenticated(selectedPlayer, pinValue);
  };

  const getPinBoxStateClass = () => {
    if (flowMode === 'VERIFY') {
      if (pinValue.length < 4) return '';
      return pinVerified ? 'valid' : pinStatus.type === 'err' ? 'invalid' : '';
    }
    if (flowMode === 'CREATE_1') return pinValue.length === 4 ? 'valid' : '';
    if (flowMode === 'CREATE_2') {
      if (pinValue.length < 4) return '';
      return pinValue === firstDraft ? 'valid' : 'invalid';
    }
    return '';
  };

  const create2Matches = flowMode === 'CREATE_2' && pinValue.length === 4 && pinValue === firstDraft;
  const create2Mismatch = flowMode === 'CREATE_2' && pinValue.length === 4 && pinValue !== firstDraft;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <div className="modal-title">☕ Horizon Casino • เลือกผู้เล่น</div>
            <div className="modal-sub">เชื่อมบัญชี Discord อัตโนมัติและยืนยันตัวตนด้วยรหัส PIN 4 หลัก</div>
          </div>
          {canClose && (
            <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
              ✕
            </button>
          )}
        </div>

        <div className="modal-body">
          <div className="auth-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: '0.92rem', color: 'var(--cinnamon)' }}>👤 คุณคือใครคะ?</strong>
              <button type="button" className="btn-pill" onClick={onRefreshPlayers} disabled={loadingPlayers}>
                {loadingPlayers ? '⏳ กำลังโหลด...' : '🔄 รีเฟรชรายชื่อ'}
              </button>
            </div>

            <button
              type="button"
              className="picker-trigger"
              onClick={() => setDropdownOpen((v) => !v)}
            >
              {selectedPlayer ? (
                <div className="picker-trigger-left">
                  <img
                    className="picker-avatar"
                    src={selectedPlayer.avatar || DEFAULT_AVATAR}
                    alt={selectedPlayer.displayName}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--espresso)' }}>
                        {selectedPlayer.displayName}
                      </strong>
                      <span className={`pin-badge ${selectedPlayer.hasPin ? 'locked' : 'unlocked'}`}>
                        {selectedPlayer.hasPin ? '🔒 มีรหัสล็อก' : '🔓 ยังไม่มีรหัส'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--mocha-muted)' }}>
                      {selectedPlayer.nickname ? `คุณ${selectedPlayer.nickname}` : `@${selectedPlayer.username}`} • 🪙{' '}
                      {Number(selectedPlayer.walletBalance || 0).toLocaleString()} เหรียญ
                    </div>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: '0.86rem', color: 'var(--mocha-muted)', fontWeight: 600 }}>
                  -- คลิกเลือกรายชื่อโปรไฟล์ Discord ของคุณ --
                </span>
              )}
              <span style={{ color: 'var(--cinnamon)', fontWeight: 700 }}>{dropdownOpen ? '▲' : '▼'}</span>
            </button>

            {dropdownOpen && (
              <div className="picker-menu">
                <div className="picker-search-wrap">
                  <input
                    type="text"
                    className="picker-search"
                    placeholder="🔍 พิมพ์ค้นหาชื่อเล่น หรือชื่อ Discord..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="picker-list">
                  {loadingPlayers ? (
                    <div style={{ padding: 18, textAlign: 'center', fontSize: '0.84rem', color: 'var(--mocha-muted)' }}>
                      ⏳ กำลังดึงรายชื่อสมาชิกจากฐานข้อมูล...
                    </div>
                  ) : filteredPlayers.length === 0 ? (
                    <div style={{ padding: 18, textAlign: 'center', fontSize: '0.84rem', color: 'var(--mocha-muted)' }}>
                      ไม่พบรายชื่อสมาชิกที่ตรงกันค่ะ
                    </div>
                  ) : (
                    filteredPlayers.map((p) => (
                      <button
                        type="button"
                        key={p.userId}
                        className={`picker-item ${p.userId === selectedId ? 'selected' : ''}`}
                        onClick={() => handleSelectUser(p)}
                      >
                        <img
                          className="picker-avatar"
                          src={p.avatar || DEFAULT_AVATAR}
                          alt={p.displayName}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--espresso)' }}>{p.displayName}</strong>
                            <span className={`pin-badge ${p.hasPin ? 'locked' : 'unlocked'}`}>
                              {p.hasPin ? '🔒' : '🔓'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--mocha-muted)' }}>
                            {p.nickname ? `คุณ${p.nickname}` : `@${p.username}`} • 👛{' '}
                            {Number(p.walletBalance || 0).toLocaleString()} เหรียญ • 📖 {p.collectedStamps?.length || 0} แสตมป์
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedPlayer && flowMode === 'VERIFY' && (
            <div className="pin-panel">
              <strong style={{ color: 'var(--cinnamon)', fontSize: '0.95rem' }}>
                🔒 กรอกรหัสผ่านคาสิโน 4 หลัก
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--mocha-muted)' }}>
                เพื่อป้องกันคนอื่นแอบปั่นสล็อตในชื่อของคุณค่ะ
              </span>
              <PinFourInputs
                digits={digits}
                setDigits={setDigits}
                stateClass={getPinBoxStateClass()}
                inputRefs={pinRefs}
                disabled={submitting}
              />
              <div className={`pin-feedback ${pinStatus.type}`}>{pinStatus.text}</div>
            </div>
          )}

          {selectedPlayer && flowMode === 'IDLE' && !selectedPlayer.hasPin && (
            <div className="pin-panel">
              <div style={{ fontSize: '1.6rem' }}>🔓</div>
              <strong style={{ color: 'var(--cinnamon)', fontSize: '0.94rem' }}>
                บัญชีนี้ยังไม่ได้ตั้งรหัส PIN 4 หลักค่ะ
              </strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--mocha-muted)', lineHeight: 1.45 }}>
                กดปุ่มด้านล่างเพื่อตั้งรหัสตัวเลข 4 หลักสำหรับล็อคกระเป๋าตังค์ก่อนเริ่มโยกสล็อตนะคะ
              </span>
            </div>
          )}

          {selectedPlayer && flowMode === 'CREATE_1' && (
            <div className="pin-panel">
              <strong style={{ color: 'var(--cinnamon)', fontSize: '0.95rem' }}>
                🔐 ตั้งรหัสผ่าน 4 หลัก (รอบที่ 1 จาก 2)
              </strong>
              <PinFourInputs
                digits={digits}
                setDigits={setDigits}
                stateClass={getPinBoxStateClass()}
                inputRefs={pinRefs}
                disabled={submitting}
              />
              <div className={`pin-feedback ${pinValue.length === 4 ? 'ok' : 'wait'}`}>
                {pinValue.length === 4 ? '✅ กรอกครบ 4 หลักแล้ว กดไปขั้นตอนยืนยันได้เลยค่ะ' : pinStatus.text}
              </div>
            </div>
          )}

          {selectedPlayer && flowMode === 'CREATE_2' && (
            <div className="pin-panel">
              <strong style={{ color: 'var(--cinnamon)', fontSize: '0.95rem' }}>
                🔐 ยืนยันรหัสผ่าน 4 หลักอีกครั้ง (รอบที่ 2 จาก 2)
              </strong>
              <PinFourInputs
                digits={digits}
                setDigits={setDigits}
                stateClass={getPinBoxStateClass()}
                inputRefs={pinRefs}
                disabled={submitting}
              />
              <div className={`pin-feedback ${create2Matches ? 'ok' : create2Mismatch ? 'err' : pinStatus.type}`}>
                {create2Matches
                  ? '✅ รหัสผ่านตรงกัน! กดตกลงเพื่อบันทึกและเข้าเล่นได้เลยค่ะ'
                  : create2Mismatch
                    ? '❌ รหัสยืนยันไม่ตรงกับรอบแรก กรุณาพิมพ์ใหม่ค่ะ'
                    : pinStatus.text}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {flowMode === 'CREATE_2' ? (
            <button type="button" className="btn-secondary" onClick={startCreatePin} disabled={submitting}>
              ◀ ตั้งรหัสใหม่
            </button>
          ) : canClose ? (
            <button type="button" className="btn-secondary" onClick={onClose}>
              ปิดหน้าต่าง
            </button>
          ) : (
            <span style={{ fontSize: '0.74rem', color: 'var(--mocha-muted)' }}>
              * กรุณาเลือกบัญชีเพื่อเข้าใช้งาน
            </span>
          )}

          {selectedPlayer && flowMode === 'VERIFY' && (
            <button
              type="button"
              className="btn-primary"
              disabled={!pinVerified}
              onClick={handleConfirmVerify}
            >
              เข้าสู่คาสิโน ➔
            </button>
          )}

          {selectedPlayer && flowMode === 'IDLE' && !selectedPlayer.hasPin && (
            <button type="button" className="btn-primary" onClick={startCreatePin}>
              🔐 สร้างรหัส 4 หลัก
            </button>
          )}

          {selectedPlayer && flowMode === 'CREATE_1' && (
            <button
              type="button"
              className="btn-primary"
              disabled={pinValue.length !== 4}
              onClick={goCreateRound2}
            >
              ยืนยันรอบที่ 1 ➔
            </button>
          )}

          {selectedPlayer && flowMode === 'CREATE_2' && (
            <button
              type="button"
              className="btn-primary"
              disabled={!create2Matches || submitting}
              onClick={handleSaveNewPin}
            >
              {submitting ? '⏳ กำลังบันทึก...' : 'ตกลงและเริ่มเล่น ➔'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}