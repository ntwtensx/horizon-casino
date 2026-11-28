import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  X,
  Search,
  Lock,
  Sparkles,
  Castle,
  Shuffle,
  Rainbow,
  Receipt,
  Layers
} from 'lucide-react';
import { FOIL_TONES, resolveStampTone } from '../utils/eventTones';
import { AnimatedText, PopModal, PopItem, ICON_BASE } from './MotionPrimitives.jsx';

const FALLBACK_CATEGORIES = [
  { id: 'LANDMARK', label: 'แลนด์มาร์ก' },
  { id: 'MIRACLE', label: 'ปาฏิหาริย์' },
  { id: 'ABSURD', label: 'ตรรกะวิบัติ' },
  { id: 'BOON', label: 'ลาภลอย' },
  { id: 'EXPENSE', label: 'รายจ่าย' }
];

const CATEGORY_ICON_MAP = {
  ALL: BookOpen,
  LANDMARK: Castle,
  MIRACLE: Sparkles,
  ABSURD: Shuffle,
  BOON: Rainbow,
  EXPENSE: Receipt
};

function getCategoryIcon(catId) {
  return CATEGORY_ICON_MAP[catId] || Layers;
}

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
      { id: 'ALL', label: 'ทั้งหมด' },
      ...raw.map((c) => ({
        id: c.id || c.key,
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
    () => new Map(categories.map((c) => [c.id, c.label])),
    [categories]
  );

  return (
    <PopModal
      isOpen={isOpen}
      onClose={onClose}
      cardClassName="stamp-modal-card"
      cardStyle={{ maxWidth: 680 }}
    >
      <div className="modal-header">
        <div>
          <div className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <BookOpen {...ICON_BASE} size={18} />
            <AnimatedText
              text="สมุดสะสมแสตมป์ Horizon Cafe"
              variant="pop"
              by="word"
              stagger={0.028}
            />
          </div>
          <div className="modal-sub">
            สะสมแล้ว <strong>{ownedCount}/{totalCount}</strong> ดวง ({progressPct}%) • แสตมป์ที่ปลดล็อกจะมีสีสันประจำดวง
          </div>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
          <X {...ICON_BASE} size={16} />
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

      {/* แท็บหมวดแสตมป์ */}
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
          const CatIcon = getCategoryIcon(c.id);
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CatIcon {...ICON_BASE} size={12} />
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* ค้นหา + กรองสถานะ */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 0 }}>
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
              placeholder="ค้นหาชื่อแสตมป์ที่ปลดล็อกแล้ว..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[
              { id: 'ALL', label: 'ทั้งหมด', Icon: null },
              { id: 'OWNED', label: 'เก็บแล้ว', Icon: Sparkles },
              { id: 'LOCKED', label: 'ยังไม่เจอ', Icon: Lock }
            ].map((f) => {
              const FilterIcon = f.Icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  className="btn-pill"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    ...(statusFilter === f.id
                      ? { background: 'var(--cinnamon)', color: '#fffdf9', borderColor: 'var(--cinnamon)' }
                      : {})
                  }}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {FilterIcon && <FilterIcon {...ICON_BASE} size={12} />}
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredStamps.length === 0 ? (
          <div className="statement-empty">
            ไม่พบแสตมป์ในเงื่อนไขที่เลือกค่ะ ลองปั่นสล็อตเพื่อปลดล็อกดวงใหม่ๆ ดูนะคะ
          </div>
        ) : (
          <div
            className="stamp-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
              gap: 8
            }}
          >
            {filteredStamps.map((stamp, idx) => {
              const isOwned = ownedSet.has(stamp.id);
              const tone = isOwned ? resolveStampTone(stamp) : undefined;
              const hasFoil = Boolean(isOwned && tone && FOIL_TONES.has(tone));
              const BadgeIcon = getCategoryIcon(stamp.category);

              return (
                <PopItem
                  key={stamp.id}
                  index={idx}
                  step={0.02}
                  maxStagger={16}
                  baseDelay={0.02}
                  data-tone={tone}
                  className={`stamp-card ${isOwned ? 'owned' : 'locked'} ${hasFoil ? 'foil-sheen' : ''}`}
                  style={{
                    borderRadius: 15,
                    padding: '10px 9px 9px',
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    {isOwned ? (
                      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{stamp.icon}</span>
                    ) : (
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: '#ebe1d7',
                          color: 'var(--mocha-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Lock {...ICON_BASE} size={13} />
                      </span>
                    )}
                    <span
                      className="stamp-badge"
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        ...(!isOwned ? { background: '#efe7de', color: 'var(--mocha-muted)' } : {})
                      }}
                    >
                      <BadgeIcon {...ICON_BASE} size={10} />
                      <span>{catLabelMap.get(stamp.category) || stamp.category}</span>
                    </span>
                  </div>

                  <div
                    className="stamp-title"
                    style={{
                      fontSize: '0.78rem',
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
                      fontSize: '0.67rem',
                      lineHeight: 1.38,
                      color: isOwned ? '#523b35' : 'var(--mocha-muted)',
                      wordBreak: 'break-word'
                    }}
                  >
                    {isOwned
                      ? stamp.desc
                      : 'ปั่นสล็อตลุ้นเจออีเวนท์นี้เพื่อปลดล็อกสีสันและรายละเอียดของแสตมป์ค่ะ'}
                  </div>
                </PopItem>
              );
            })}
          </div>
        )}
      </div>
    </PopModal>
  );
}