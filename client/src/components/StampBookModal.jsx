import React, { useEffect, useMemo, useState } from 'react';

export default function StampBookModal({
  isOpen,
  onClose,
  stampCatalog,
  activePlayer,
  initialCategory = 'ALL'
}) {
  const [activeCat, setActiveCat] = useState('ALL');

  useEffect(() => {
    if (isOpen) setActiveCat(initialCategory || 'ALL');
  }, [isOpen, initialCategory]);

  const allStamps = stampCatalog?.stamps || [];
  const categories = stampCatalog?.categories || [];

  const ownedSet = useMemo(
    () => new Set(Array.isArray(activePlayer?.collectedStamps) ? activePlayer.collectedStamps : []),
    [activePlayer]
  );

  if (!isOpen) return null;

  const totalUnlocked = allStamps.filter((s) => ownedSet.has(s.id)).length;
  const pct = Math.min(100, Math.round((totalUnlocked / (allStamps.length || 1)) * 100));
  const filtered = activeCat === 'ALL' ? allStamps : allStamps.filter((s) => s.category === activeCat);

  const ownerLabel = activePlayer
    ? activePlayer.nickname
      ? `คุณ${activePlayer.nickname}`
      : activePlayer.displayName
    : 'ผู้เยี่ยมชม';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card stamp-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">📖 สมุดสะสมแสตมป์โชคชะตา • ของ {ownerLabel}</div>
            <div className="modal-sub">
              การ์ดสีละมุนคืออีเวนท์ที่เคยปั่นเจอแล้ว • หากยังไม่เคยเจอจะแสดงเฉพาะอิโมจิและ ???
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        <div className="stamp-controls">
          <div className="stamp-progress-wrap">
            <span>
              สะสมแล้ว {totalUnlocked} / {allStamps.length} ดวง ({pct}%)
            </span>
            <div className="stamp-progress-bar">
              <div className="stamp-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="stamp-tabs">
            {categories.map((cat) => {
              const list = cat.id === 'ALL' ? allStamps : allStamps.filter((s) => s.category === cat.id);
              const unlockedCount = list.filter((s) => ownedSet.has(s.id)).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`stamp-tab ${activeCat === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCat(cat.id)}
                >
                  <span>
                    {cat.icon} {cat.title}
                  </span>
                  <span style={{ opacity: 0.8 }}>
                    ({unlockedCount}/{list.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="modal-body">
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 36, color: 'var(--mocha-muted)' }}>
              ยังไม่มีรายการแสตมป์ในหมวดนี้ค่ะ
            </div>
          ) : (
            <div className="stamp-grid">
              {filtered.map((s) => {
                const isOwned = ownedSet.has(s.id);
                if (isOwned) {
                  return (
                    <div key={s.id} className={`stamp-card unlocked tone-${s.tone || 'miracle'}`}>
                      <span className="stamp-badge">✓ สะสมแล้ว</span>
                      <div className="stamp-emoji">{s.icon}</div>
                      <div className="stamp-title">{s.title}</div>
                      <div className="stamp-desc" title={s.desc}>
                        {s.desc}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={s.id} className="stamp-card locked">
                    <div className="stamp-emoji">{s.icon}</div>
                    <div className="stamp-title">???</div>
                    <div className="stamp-desc">ยังไม่เคยปั่นเจอ</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}