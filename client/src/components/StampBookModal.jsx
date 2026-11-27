import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FOIL_TONES, resolveStampTone } from '../utils/eventTones';

const FALLBACK_CATEGORIES = [
  { id: 'LANDMARK', icon: '🏰', label: 'แลนด์มาร์ก' },
  { id: 'MIRACLE', icon: '🌟', label: 'ปาฏิหาริย์' },
  { id: 'ABSURD', icon: '🌀', label: 'ตรรกะวิบัติ' },
  { id: 'BOON', icon: '🌈', label: 'ลาภลอย' },
  { id: 'EXPENSE', icon: '💸', label: 'รายจ่าย' }
];

export default function StampBookModal({
  isOpen,
  onClose,
  stampCatalog,
  activePlayer,
  initialCategory = 'ALL'
}) {
  const [activeCat, setActiveCat] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | OWNED | LOCKED
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setActiveCat(initialCategory || 'ALL');
    setStatusFilter('ALL');
    setSearch('');
  }, [isOpen, initialCategory]);

  const stamps = useMemo(
    () => (Array.isArray(stampCatalog?.stamps) ? stampCatalog.stamps : []),
    [stampCatalog]
  );

  const ownedSet = useMemo(
    () => new Set(activePlayer?.collectedStamps || []),
    [activePlayer]
  );

  const categories = useMemo(() => {
    const raw =
      Array.isArray(stampCatalog?.categories) && stampCatalog.categories.length > 0
        ? stampCatalog.categories
        : FALLBACK_CATEGORIES;
    return [
      { id: 'ALL', icon: '📖', label: 'ทั้งหมด' },
      ...raw.map((c) => ({
        id: c.id || c.key,
        icon: c.icon || '✨',
        label: c.shortLabel || c.label || c.name || c.id
      }))
    ];
  }, [stampCatalog]);

  const totalCount = stampCatalog?.totalStamps || stamps.length || 158;
  const ownedCount = useMemo(
    () => stamps.filter((s) => ownedSet.has(s.id)).length,
    [stamps, ownedSet]
  );
  const progressPct = totalCount > 0 ? Math.min(100, Math.round((ownedCount / totalCount) * 100)) : 0;

  const filteredStamps = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return stamps.filter((s) => {
      if (activeCat !== 'ALL' && s.category !== activeCat) return false;
      const isOwned = ownedSet.has(s.id);
      if (statusFilter === 'OWNED' && !isOwned) return false;
      if (statusFilter === 'LOCKED' && isOwned) return false;
      if (!kw) return true;
      if (!isOwned) return false;
      return `${s.title || ''} ${s.desc || ''} ${s.icon || ''}`.toLowerCase().includes(kw);
    });
  }, [stamps, activeCat, statusFilter, search, ownedSet]);

  const catLabelMap = useMemo(
    () => new Map(categories.map((c) => [c.id, `${c.icon} ${c.label}`])),
    [categories]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-card stamp-modal-card"
            style={{ maxWidth: 680 }}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="modal-title">📖 สมุดสะสมแสตมป์ Horizon Cafe</div>
                <div className="modal-sub">
                  สะสมแล้ว <strong>{ownedCount}/{totalCount}</strong> ดวง ({progressPct}%) • แสตมป์ที่ปลดล็อกจะมีสีสันประจำดวง
                </div>
              </div>
              <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
                ✕
              </button>
            </div>

            {/* แถบความคืบหน้ารวม */}
            <div style={{ padding: '8px 16px 2px', background: 'var(--surface-warm)' }}>
              <div className="spin-progress-track" aria-hidden="true">
                <motion.div
                  className="spin-progress-fill"
                  initial={false}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* แท็บหมวดแสตมป์พร้อมพื้นหลังไหลตามนิ้ว */}
            <div
              className="lb-filter-tabs"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 5,
                padding: '8px 14px'
              }}
            >
              {categories.map((c) => {
                const isActive = activeCat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`lb-tab-btn ${isActive ? 'active' : ''}`}
                    style={{ padding: '6px 10px', flex: '0 0 auto' }}
                    onClick={() => setActiveCat(c.id)}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="stamp-cat-pill"
                        className="lb-tab-pill-bg"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span>{c.icon} {c.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* ค้นหา + กรองสถานะ */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  className="picker-search"
                  style={{ flex: '1 1 170px', minWidth: 0 }}
                  placeholder="🔍 ค้นหาชื่อแสตมป์ที่ปลดล็อกแล้ว..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 5 }}>
                  {[
                    { id: 'ALL', label: 'ทั้งหมด' },
                    { id: 'OWNED', label: '✨ เก็บแล้ว' },
                    { id: 'LOCKED', label: '🔒 ยังไม่เจอ' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="btn-pill"
                      style={
                        statusFilter === f.id
                          ? { background: 'var(--cinnamon)', color: '#fffdf9', borderColor: 'var(--cinnamon)' }
                          : undefined
                      }
                      onClick={() => setStatusFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredStamps.length === 0 ? (
                <div className="statement-empty">
                  ไม่พบแสตมป์ในเงื่อนไขที่เลือกค่ะ ลองปั่นสล็อตเพื่อปลดล็อกดวงใหม่ๆ ดูนะคะ ✨
                </div>
              ) : (
                <div
                  className="stamp-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: 8
                  }}
                >
                  {filteredStamps.map((stamp) => {
                    const isOwned = ownedSet.has(stamp.id);
                    const tone = isOwned ? resolveStampTone(stamp) : undefined;
                    const hasFoil = Boolean(isOwned && tone && FOIL_TONES.has(tone));

                    return (
                      <div
                        key={stamp.id}
                        data-tone={tone}
                        className={`stamp-card ${isOwned ? 'owned' : 'locked'} ${hasFoil ? 'foil-sheen' : ''}`}
                        style={{
                          borderRadius: 15,
                          padding: '10px 10px 9px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 5,
                          ...(!isOwned
                            ? {
                                background: 'var(--surface-warm)',
                                border: '1.5px dashed var(--border-cream)',
                                opacity: 0.72
                              }
                            : {})
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: '1.45rem', lineHeight: 1 }}>
                            {isOwned ? stamp.icon : '🔒'}
                          </span>
                          <span
                            className="stamp-badge"
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 999,
                              whiteSpace: 'nowrap',
                              ...(!isOwned ? { background: '#efe7de', color: 'var(--mocha-muted)' } : {})
                            }}
                          >
                            {catLabelMap.get(stamp.category) || stamp.category}
                          </span>
                        </div>

                        <div
                          className="stamp-title"
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            lineHeight: 1.3,
                            wordBreak: 'break-word',
                            ...(!isOwned ? { color: 'var(--mocha-muted)' } : {})
                          }}
                        >
                          {isOwned ? stamp.title : '??? (ยังไม่ค้นพบ)'}
                        </div>

                        <div
                          className="stamp-desc"
                          style={{
                            fontSize: '0.68rem',
                            lineHeight: 1.38,
                            color: isOwned ? '#523b35' : 'var(--mocha-muted)',
                            wordBreak: 'break-word'
                          }}
                        >
                          {isOwned
                            ? stamp.desc
                            : 'ปั่นสล็อตลุ้นเจออีเวนท์นี้เพื่อปลดล็อกสีสันและรายละเอียดของแสตมป์ค่ะ'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}