import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

// รูปทรงเรขาคณิต SVG + คู่สีไล่เฉด 2 สีประจำแลนด์มาร์กทั้ง 5 โซน
const GEO_SHAPES = {
  GARDEN: {
    d: 'M22 3 L40 16 L33 38 L11 38 L4 16 Z', // ห้าเหลี่ยม (Pentagon)
    c1: '#5EA377',
    c2: '#A8E6CF',
    stroke: '#3A7D54',
    e1: '#E5F2EA',
    e2: '#F6FBF8'
  },
  SAKURA: {
    d: 'M22 3 L27.6 14.4 L40 16 L30.8 24.7 L33.2 37.5 L22 31.2 L10.8 37.5 L13.2 24.7 L4 16 L16.4 14.4 Z', // ดาว 5 แฉกมน
    c1: '#F48FB1',
    c2: '#FFD3B6',
    stroke: '#C95D82',
    e1: '#FBEAF0',
    e2: '#FFF6F2'
  },
  MEADOW: {
    d: 'M22 3 L38 12.2 L38 31.8 L22 41 L6 31.8 L6 12.2 Z', // หกเหลี่ยม (Hexagon)
    c1: '#9B7EDE',
    c2: '#C4B5FD',
    stroke: '#6D4FB3',
    e1: '#EFEAFC',
    e2: '#F8F5FF'
  },
  BEACH: {
    d: 'M22 3 L40 22 L22 41 L4 22 Z', // ข้าวหลามตัด (Diamond)
    c1: '#4FC3F7',
    c2: '#FFE082',
    stroke: '#2E8DB8',
    e1: '#E6F5FC',
    e2: '#FFF9E8'
  },
  RIVER: {
    d: 'M12 4 H32 Q40 4 40 12 V25 Q40 36 22 41 Q4 36 4 25 V12 Q4 4 12 4 Z', // สี่เหลี่ยมโล่มน (Squircle Shield)
    c1: '#4DB6AC',
    c2: '#90CAF9',
    stroke: '#2F827A',
    e1: '#E5F4F2',
    e2: '#F0F7FE'
  }
};

const shortName = (p) => (p?.nickname?.trim() ? p.nickname.trim() : p?.displayName || 'สมาชิก');
const netWorthOf = (p) => Number(p?.walletBalance || 0) + Math.max(0, Number(p?.bankBalance || 0));

function AccountTag({ type }) {
  if (type === 'bot') return <span className="account-type-tag bot">🤖 บอท</span>;
  if (type === 'web') return <span className="account-type-tag web">🌐 เว็บ</span>;
  return <span className="account-type-tag discord">💬 Discord</span>;
}

export default function TopFloatingDeck({
  landmarks = [],
  players = [],
  activePlayerId = '',
  onRefreshPlayers
}) {
  const [selectedLmId, setSelectedLmId] = useState(null);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbTab, setLbTab] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // จัดกลุ่มผู้เล่นทั้งร้านเป็น 3 หมวดตามยอดทรัพย์สินสุทธิ (กระเป๋า + ธนาคาร)
  const ranking = useMemo(() => {
    const withNet = (players || []).map((p) => ({ ...p, netWorth: netWorthOf(p) }));
    const rich = withNet.filter((p) => p.netWorth > 0).sort((a, b) => b.netWorth - a.netWorth);
    const broke = withNet.filter((p) => p.netWorth === 0).sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
    // จนที่สุด (ติดลบมากสุด) ขึ้นก่อน ไล่ไปจนถึงหนี้น้อยสุด
    const debt = withNet.filter((p) => p.netWorth < 0).sort((a, b) => a.netWorth - b.netWorth);
    return { rich, broke, debt };
  }, [players]);

  const sultan = ranking.rich[0] || null;
  const otherRich = ranking.rich.slice(1);
  const beggar = ranking.debt[0] || null;
  const otherDebt = ranking.debt.slice(1);
  const ownedCount = landmarks.filter((l) => l.owned).length;

  // เลื่อนแลนด์มาร์กที่เพิ่งคลิกขึ้นมาบนสุดของลิ้นชักเพื่อให้เห็นรายละเอียดทันที
  const orderedLandmarks = useMemo(() => {
    if (!selectedLmId) return landmarks;
    const picked = landmarks.find((l) => l.id === selectedLmId);
    if (!picked) return landmarks;
    return [picked, ...landmarks.filter((l) => l.id !== selectedLmId)];
  }, [landmarks, selectedLmId]);

  const handleRefresh = async () => {
    if (!onRefreshPlayers || refreshing) return;
    setRefreshing(true);
    await onRefreshPlayers();
    setRefreshing(false);
  };

  const renderPlayerRow = (p, idx, group) => {
    const isTopSultan = group === 'RICH' && idx === 0;
    const isTopBeggar = group === 'DEBT' && idx === 0;
    const rowCls = [
      'lb-player-row',
      isTopSultan ? 'rank-sultan foil-sheen' : '',
      isTopBeggar ? 'rank-beggar' : '',
      p.userId === activePlayerId ? 'is-me' : ''
    ]
      .filter(Boolean)
      .join(' ');

    const netCls = p.netWorth > 0 ? 'pos' : p.netWorth < 0 ? 'neg' : 'zero';
    const rankIcon = isTopSultan ? '👑' : isTopBeggar ? '🥣' : `#${idx + 1}`;

    return (
      <motion.div
        key={p.userId}
        className={rowCls}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(idx * 0.035, 0.25) }}
      >
        <div className="lb-rank-num">{rankIcon}</div>
        <img
          className="lb-row-avatar"
          src={p.avatar || DEFAULT_AVATAR}
          alt={p.displayName}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_AVATAR;
          }}
        />
        <div className="lb-row-info">
          <div className="lb-row-name-line">
            <span>{p.displayName}</span>
            <AccountTag type={p.accountType} />
          </div>
          <div className="lb-row-breakdown">
            <span>👛 {Number(p.walletBalance || 0).toLocaleString()}</span>
            <span>🏦 {Number(p.bankBalance || 0).toLocaleString()}</span>
            <span>📖 {p.collectedStamps?.length || 0}</span>
          </div>
        </div>
        <div className={`lb-row-net ${netCls}`}>
          {p.netWorth > 0 ? `+${p.netWorth.toLocaleString()}` : p.netWorth.toLocaleString()} 🪙
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <section className="top-floating-deck" aria-label="แถบลอยแลนด์มาร์กและอันดับการเงิน">
        {/* 🏰 กล่องลอยแลนด์มาร์ก 5 โซน: รูปทรงเรขาคณิต + สีไล่เฉด 2 สี */}
        <div className="lm-geo-deck" role="group" aria-label="แลนด์มาร์กริมหน้าต่าง 5 โซน">
          {landmarks.map((lm) => {
            const shape = GEO_SHAPES[lm.id] || GEO_SHAPES.RIVER;
            const gradId = `lm-grad-${lm.id}`;
            return (
              <button
                key={lm.id}
                type="button"
                className={`lm-geo-btn ${lm.owned ? 'owned' : 'empty'}`}
                onClick={() => setSelectedLmId((curr) => (curr === lm.id ? null : lm.id))}
                title={lm.owned ? `${lm.name} • ${lm.ownerName} (ขั้น ${lm.tier})` : `${lm.name} • ว่าง`}
                aria-label={`ดูรายละเอียดแลนด์มาร์ก ${lm.name}`}
              >
                <svg className="lm-geo-svg" viewBox="0 0 44 44" aria-hidden="true">
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={lm.owned ? shape.c1 : shape.e1} />
                      <stop offset="100%" stopColor={lm.owned ? shape.c2 : shape.e2} />
                    </linearGradient>
                  </defs>
                  <path
                    d={shape.d}
                    fill={`url(#${gradId})`}
                    stroke={lm.owned ? shape.stroke : '#C9B4A1'}
                    strokeWidth={lm.owned ? '2.2' : '1.5'}
                    strokeDasharray={lm.owned ? undefined : '3 2'}
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="lm-geo-emoji">{lm.icon}</span>
                {lm.owned && lm.tier > 0 && <span className="lm-geo-tier">{lm.tier}</span>}
                {lm.curtainClosed && <span className="lm-geo-curtain">🪟</span>}
              </button>
            );
          })}
        </div>

        {/* 🏆 แถบลอย Leaderboard: [สุลต่าน + รูปคนมีเงิน] | [ยาจก + รูปคนเป็นหนี้] */}
        <button
          type="button"
          className="lb-mini-bar"
          onClick={() => setLbOpen(true)}
          title="คลิกเพื่อเปิดตารางอันดับการเงินของทุกคนในคาเฟ่"
        >
          <div className="lb-side sultan">
            {sultan ? (
              <>
                <span className="lb-crown-badge sultan">
                  <span className="lb-crown-icon">👑</span>
                  <span className="lb-champ-name">{shortName(sultan)}</span>
                </span>
                {otherRich.length > 0 && (
                  <span className="lb-avatar-stack" aria-hidden="true">
                    {otherRich.slice(0, 4).map((p) => (
                      <img
                        key={p.userId}
                        className="lb-mini-avatar"
                        src={p.avatar || DEFAULT_AVATAR}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                    ))}
                    {otherRich.length > 4 && <span className="lb-more-dot">+{otherRich.length - 4}</span>}
                  </span>
                )}
              </>
            ) : (
              <span className="lb-crown-badge peace">👑 รอสุลต่านคนแรก</span>
            )}
          </div>

          <span className="lb-divider" aria-hidden="true" />

          <div className="lb-side beggar">
            {beggar ? (
              <>
                {otherDebt.length > 0 && (
                  <span className="lb-avatar-stack" aria-hidden="true">
                    {otherDebt.slice(0, 3).map((p) => (
                      <img
                        key={p.userId}
                        className="lb-mini-avatar is-debt"
                        src={p.avatar || DEFAULT_AVATAR}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                    ))}
                    {otherDebt.length > 3 && <span className="lb-more-dot">+{otherDebt.length - 3}</span>}
                  </span>
                )}
                <span className="lb-crown-badge beggar">
                  <span className="lb-crown-icon">🥣</span>
                  <span className="lb-champ-name">{shortName(beggar)}</span>
                </span>
              </>
            ) : (
              <span className="lb-crown-badge peace">✨ ไร้หนี้ทั้งร้าน</span>
            )}
          </div>
        </button>
      </section>

      {/* 🏰 ลิ้นชักลอยรายละเอียดแลนด์มาร์ก (เปิดเมื่อคลิกที่รูปทรงใดก็ได้) */}
      <AnimatePresence>
        {selectedLmId && (
          <>
            <motion.div
              className="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLmId(null)}
            />
            <div className="floating-drawer-wrap">
              <motion.aside
                className="floating-top-drawer"
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              >
                <div className="drawer-row-between">
                  <div className="brand-title">
                    <span>🏰 แลนด์มาร์กริมหน้าต่าง</span>
                    <span className="brand-badge">ถือครอง {ownedCount}/5 โซน</span>
                  </div>
                  <button
                    type="button"
                    className="drawer-close-pill"
                    onClick={() => setSelectedLmId(null)}
                  >
                    ✕ พับเก็บ
                  </button>
                </div>

                <div className="landmark-rows-list">
                  {orderedLandmarks.map((lm, idx) => (
                    <motion.div
                      key={lm.id}
                      className={`landmark-row-card ${lm.owned ? 'owned' : 'empty'} ${
                        lm.id === selectedLmId ? 'is-highlighted' : ''
                      }`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: idx * 0.035 }}
                    >
                      <div className="landmark-row-icon">{lm.icon}</div>
                      <div className="landmark-row-body">
                        <div className="landmark-row-head">
                          <span className="landmark-row-name">{lm.name}</span>
                          <span className={`landmark-tier-pill ${lm.owned ? 'owned' : 'empty'}`}>
                            {lm.owned ? `ขั้น ${lm.tier} • ${lm.pct}%` : 'ว่าง • 0%'}
                          </span>
                        </div>
                        <div className="landmark-row-owner">
                          {lm.owned ? (
                            <>
                              <span>
                                ผู้ถือหุ้น: <strong>{lm.ownerName}</strong>
                              </span>
                              {lm.curtainClosed && (
                                <span className="landmark-curtain-tag">🪟 ปิดผ้าม่านพัก 1 รอบ</span>
                              )}
                            </>
                          ) : (
                            <span>ยังไม่มีผู้ถือครอง — ปั่นสล็อตลุ้นรับสิทธิ์ขั้นที่ 1 (17%) ฟรี!</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.aside>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* 🏆 หน้าต่าง Leaderboard เต็มรูปแบบ: รวยสุด-มีเงิน / หมดตัว / จนที่สุด-หนี้น้อยสุด */}
      <AnimatePresence>
        {lbOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLbOpen(false)}
          >
            <motion.div
              className="modal-card lb-modal-card"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <div className="modal-title">🏆 อันดับการเงิน Horizon Cafe</div>
                  <div className="modal-sub">
                    คำนวณจากยอดสุทธิรวม (กระเป๋า + ธนาคาร) • สมาชิกทั้งหมด {players.length} คน
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-pill"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    {refreshing ? '⏳' : '🔄'}
                  </button>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setLbOpen(false)}
                    aria-label="ปิด"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* แท็บกรองหมวดพร้อมพื้นหลังไหลตามนิ้ว (layoutId) */}
              <div className="lb-filter-tabs">
                {[
                  { id: 'ALL', label: `ทั้งหมด (${players.length})` },
                  { id: 'RICH', label: `👑 มีเงิน (${ranking.rich.length})` },
                  { id: 'BROKE', label: `🪙 หมดตัว (${ranking.broke.length})` },
                  { id: 'DEBT', label: `💸 หนี้ (${ranking.debt.length})` }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`lb-tab-btn ${lbTab === t.id ? 'active' : ''}`}
                    onClick={() => setLbTab(t.id)}
                  >
                    {lbTab === t.id && (
                      <motion.span
                        layoutId="lb-tab-pill"
                        className="lb-tab-pill-bg"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="modal-body">
                {(lbTab === 'ALL' || lbTab === 'RICH') && (
                  <div className="lb-section-block">
                    <div className="lb-section-head">
                      <span>👑 รวยสุด ➔ มีเงิน</span>
                      <span>{ranking.rich.length} คน</span>
                    </div>
                    {ranking.rich.length === 0 ? (
                      <div className="statement-empty">ยังไม่มีใครถือทรัพย์สินสุทธิเป็นบวกเลยค่ะ</div>
                    ) : (
                      ranking.rich.map((p, i) => renderPlayerRow(p, i, 'RICH'))
                    )}
                  </div>
                )}

                {(lbTab === 'ALL' || lbTab === 'BROKE') && (
                  <div className="lb-section-block">
                    <div className="lb-section-head">
                      <span>🪙 หมดตัว (0 เหรียญ)</span>
                      <span>{ranking.broke.length} คน</span>
                    </div>
                    {ranking.broke.length === 0 ? (
                      <div className="statement-empty">ไม่มีสมาชิกที่มียอด 0 เหรียญพอดีค่ะ</div>
                    ) : (
                      ranking.broke.map((p, i) => renderPlayerRow(p, i, 'BROKE'))
                    )}
                  </div>
                )}

                {(lbTab === 'ALL' || lbTab === 'DEBT') && (
                  <div className="lb-section-block">
                    <div className="lb-section-head">
                      <span>💸 จนที่สุด ➔ หนี้น้อยสุด</span>
                      <span>{ranking.debt.length} คน</span>
                    </div>
                    {ranking.debt.length === 0 ? (
                      <div className="statement-empty">✨ เยี่ยมมาก! ตอนนี้ทั้งร้านยังไม่มีใครติดหนี้เลยค่ะ</div>
                    ) : (
                      ranking.debt.map((p, i) => renderPlayerRow(p, i, 'DEBT'))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}