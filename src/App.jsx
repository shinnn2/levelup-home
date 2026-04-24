import React, { useState, useEffect, useCallback } from 'react';
import { Home, ShoppingBag, Check, Gift, Settings, Clock, LogOut, Globe, Trash2, Plus, Edit2 } from 'lucide-react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { translations, detectLanguage } from './i18n';

const FIRESTORE_COLLECTION = 'levelup_home_families';

const playSound = (type) => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  if (type === 'levelUp') {
    [440, 554.37, 659.25, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, ctx.currentTime + i * 0.15);
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.15 + 0.05);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.15 + 0.4);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.15); o.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } else if (type === 'coupon') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(523.25, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.5);
  }
};

const Confetti = ({ onComplete }) => {
  useEffect(() => { const t = setTimeout(onComplete, 3000); return () => clearTimeout(t); }, [onComplete]);
  const particles = React.useMemo(() => [...Array(50)].map((_, i) => ({
    id: i, left: `${Math.random() * 100}%`,
    color: ['#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA'][Math.floor(Math.random() * 5)],
    duration: 2 + Math.random() * 3, delay: Math.random() * 2,
  })), []);
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      {particles.map(p => (
        <div key={p.id} style={{ position: 'absolute', left: p.left, top: '-20px', backgroundColor: p.color, width: '10px', height: '10px', borderRadius: '50%', animation: `cf ${p.duration}s linear forwards`, animationDelay: `${p.delay}s` }} />
      ))}
      <style>{`@keyframes cf { to { transform: translateY(100vh) rotate(360deg); opacity: 0; } }`}</style>
    </div>
  );
};

// 기본 상점 아이템 (한/영)
const DEFAULT_SHOP_ITEMS_KO = [
  { id: 'i1', name: '유튜브/게임 30분 추가', price: 100, minLevel: 1, icon: '📺' },
  { id: 'i2', name: '좋아하는 간식 선택', price: 150, minLevel: 1, icon: '🍪' },
  { id: 'i3', name: '아빠/엄마랑 특별한 시간 30분', price: 200, minLevel: 1, icon: '👨‍👧' },
  { id: 'i4', name: '주말 영화 선택권', price: 250, minLevel: 3, icon: '🍿' },
  { id: 'i5', name: '디저트 카페 데이트', price: 300, minLevel: 5, icon: '🧋' },
  { id: 'i6', name: '친구 집 놀러가기', price: 400, minLevel: 5, icon: '👫' },
  { id: 'i7', name: '장난감/책 선물 (1만원)', price: 600, minLevel: 8, icon: '🎁' },
  { id: 'i8', name: '놀이공원 하루 나들이', price: 1000, minLevel: 10, icon: '🎢' },
  { id: 'i9', name: '원하는 저녁 메뉴 선택', price: 150, minLevel: 1, icon: '🍕' },
  { id: 'i10', name: '늦게 자는 날 (30분)', price: 200, minLevel: 3, icon: '🌙' },
];

const DEFAULT_SHOP_ITEMS_EN = [
  { id: 'i1', name: 'Extra 30 min YouTube/Gaming', price: 100, minLevel: 1, icon: '📺' },
  { id: 'i2', name: 'Choose Favorite Snack', price: 150, minLevel: 1, icon: '🍪' },
  { id: 'i3', name: 'Special 30 min with Dad/Mom', price: 200, minLevel: 1, icon: '👨‍👧' },
  { id: 'i4', name: 'Pick Weekend Movie', price: 250, minLevel: 3, icon: '🍿' },
  { id: 'i5', name: 'Dessert Cafe Date', price: 300, minLevel: 5, icon: '🧋' },
  { id: 'i6', name: 'Friend Playdate', price: 400, minLevel: 5, icon: '👫' },
  { id: 'i7', name: 'Toy/Book Gift ($10)', price: 600, minLevel: 8, icon: '🎁' },
  { id: 'i8', name: 'Theme Park Day', price: 1000, minLevel: 10, icon: '🎢' },
  { id: 'i9', name: 'Choose Dinner Menu', price: 150, minLevel: 1, icon: '🍕' },
  { id: 'i10', name: 'Late Bedtime (30 min)', price: 200, minLevel: 3, icon: '🌙' },
];

const getTitle = (lv, t) => {
  if (lv < 5) return { text: t.trainee, emoji: '🌱', gear: '' };
  if (lv < 10) return { text: t.juniorWarrior, emoji: '🗡️', gear: '🗡️' };
  if (lv < 20) return { text: t.braveWarrior, emoji: '⚔️', gear: '⚔️' };
  if (lv < 50) return { text: t.superWarrior, emoji: '🛡️', gear: '🛡️' };
  return { text: t.masterWarrior, emoji: '👑', gear: '👑' };
};

const RANK_LEVELS = [
  { key: 'trainee', minLevel: 1, emoji: '🌱' },
  { key: 'juniorWarrior', minLevel: 5, emoji: '🗡️' },
  { key: 'braveWarrior', minLevel: 10, emoji: '⚔️' },
  { key: 'superWarrior', minLevel: 20, emoji: '🛡️' },
  { key: 'masterWarrior', minLevel: 50, emoji: '👑' },
];

const getNextRankInfo = (currentLevel) => {
  const next = RANK_LEVELS.find(r => r.minLevel > currentLevel);
  if (!next) return null;
  return { ...next, levelsRemaining: next.minLevel - currentLevel };
};

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const normalizeInventory = (inv) => Array.isArray(inv) ? inv : [];

const EMOJI_CATALOG = [
  // 무료 (레벨 1, 기본 선택 가능)
  { id: 'e_cat', emoji: '🐱', minLevel: 1, price: 0 },
  { id: 'e_dog', emoji: '🐶', minLevel: 1, price: 0 },
  { id: 'e_bear', emoji: '🐻', minLevel: 1, price: 0 },
  { id: 'e_frog', emoji: '🐸', minLevel: 1, price: 0 },
  { id: 'e_fox', emoji: '🦊', minLevel: 1, price: 0 },
  { id: 'e_panda', emoji: '🐼', minLevel: 1, price: 0 },
  { id: 'e_monkey', emoji: '🐵', minLevel: 1, price: 0 },
  { id: 'e_hamster', emoji: '🐹', minLevel: 1, price: 0 },
  // 레벨 5+ (50 코인)
  { id: 'e_star', emoji: '⭐', minLevel: 5, price: 50 },
  { id: 'e_lion', emoji: '🦁', minLevel: 5, price: 50 },
  { id: 'e_tiger', emoji: '🐯', minLevel: 5, price: 50 },
  { id: 'e_owl', emoji: '🦉', minLevel: 5, price: 50 },
  { id: 'e_butterfly', emoji: '🦋', minLevel: 5, price: 50 },
  { id: 'e_cherry', emoji: '🌸', minLevel: 5, price: 50 },
  { id: 'e_rainbow', emoji: '🌈', minLevel: 5, price: 50 },
  { id: 'e_clover', emoji: '🍀', minLevel: 5, price: 50 },
  // 레벨 10+ (100 코인)
  { id: 'e_dragon', emoji: '🐉', minLevel: 10, price: 100 },
  { id: 'e_eagle', emoji: '🦅', minLevel: 10, price: 100 },
  { id: 'e_peacock', emoji: '🦚', minLevel: 10, price: 100 },
  { id: 'e_hibiscus', emoji: '🌺', minLevel: 10, price: 100 },
  { id: 'e_glow_star', emoji: '🌟', minLevel: 10, price: 100 },
  { id: 'e_art', emoji: '🎨', minLevel: 10, price: 100 },
  { id: 'e_music', emoji: '🎵', minLevel: 10, price: 100 },
  { id: 'e_mask', emoji: '🎭', minLevel: 10, price: 100 },
  // 레벨 20+ (200 코인)
  { id: 'e_crown', emoji: '👑', minLevel: 20, price: 200 },
  { id: 'e_gem', emoji: '💎', minLevel: 20, price: 200 },
  { id: 'e_fire', emoji: '🔥', minLevel: 20, price: 200 },
  { id: 'e_bolt', emoji: '⚡', minLevel: 20, price: 200 },
  { id: 'e_moon', emoji: '🌙', minLevel: 20, price: 200 },
  { id: 'e_sun', emoji: '☀️', minLevel: 20, price: 200 },
  { id: 'e_firework', emoji: '🎆', minLevel: 20, price: 200 },
  { id: 'e_sparkler', emoji: '🎇', minLevel: 20, price: 200 },
  // 레벨 50+ (500 코인) — 마스터
  { id: 'e_trophy', emoji: '🏆', minLevel: 50, price: 500 },
  { id: 'e_unicorn', emoji: '🦄', minLevel: 50, price: 500 },
  { id: 'e_comet', emoji: '💫', minLevel: 50, price: 500 },
  { id: 'e_planet', emoji: '🪐', minLevel: 50, price: 500 },
  { id: 'e_galaxy', emoji: '🌌', minLevel: 50, price: 500 },
];

const FREE_EMOJIS = EMOJI_CATALOG.filter(e => e.price === 0);
const FREE_EMOJI_IDS = FREE_EMOJIS.map(e => e.id);

const makeEmptyPlayer = (name, age, emoji = '🐱') => ({ name, age: parseInt(age) || 10, exp: 0, level: 1, coins: 0, inventory: [], purchasedOneTimeItems: [], history: [], emoji, ownedEmojis: [...FREE_EMOJI_IDS] });

// === ONBOARDING ===
function Onboarding({ lang, setLang, onComplete }) {
  const t = translations[lang];
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState('');
  const [pin, setPin] = useState('');
  const [children, setChildren] = useState([{ name: '', age: '', emoji: '🐱' }]);

  const addChild = () => { if (children.length < 3) setChildren([...children, { name: '', age: '', emoji: '🐱' }]); };
  const removeChild = (i) => setChildren(children.filter((_, idx) => idx !== i));
  const updateChild = (i, field, val) => {
    const nc = [...children];
    nc[i][field] = val;
    setChildren(nc);
  };

  const canProceed = () => {
    if (step === 2) return familyName.trim().length > 0;
    if (step === 3) return pin.length === 4 && /^\d{4}$/.test(pin);
    if (step === 4) return children.every(c => c.name.trim() && c.age);
    return true;
  };

  const finish = () => {
    const items = lang === 'ko' ? DEFAULT_SHOP_ITEMS_KO : DEFAULT_SHOP_ITEMS_EN;
    const players = {};
    children.forEach(c => { players[c.name.trim()] = makeEmptyPlayer(c.name.trim(), c.age, c.emoji || '🐱'); });
    onComplete({
      familyName: familyName.trim(),
      pin,
      players,
      activeUser: children[0].name.trim(),
      shopItems: items,
      language: lang,
      dailyMissions: [],
      favoriteRewards: [],
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", padding: 20, display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 800 }}>{t.stepOf} {step} / 5</span>
        <button onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')} style={{ background: '#fff', border: '1px solid #c7d2fe', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 800, color: '#4f46e5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Globe size={12} /> {t.languageToggle}
        </button>
      </div>

      <div style={{ flex: 1, background: '#fff', borderRadius: 28, padding: 28, boxShadow: '0 10px 40px rgba(79,70,229,0.1)' }}>
        {step === 1 && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>⚔️</div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#4f46e5', marginBottom: 12 }}>{t.welcome}</h1>
            <p style={{ fontSize: 14, color: '#6b7280', fontWeight: 600, lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>{t.welcomeDesc}</p>
          </div>
        )}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#4338ca', marginBottom: 16 }}>{t.familyNameLabel}</h2>
            <input autoFocus value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder={t.familyNamePlaceholder} maxLength={20} style={{ width: '100%', padding: '14px 16px', fontSize: 16, border: '2px solid #e5e7eb', borderRadius: 16, outline: 'none', boxSizing: 'border-box', fontWeight: 700 }} />
          </div>
        )}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#4338ca', marginBottom: 8 }}>{t.pinSetupTitle}</h2>
            <p style={{ fontSize: 13, color: '#4b5563', fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>{t.pinSetupDesc}</p>
            <div style={{ background: '#f9fafb', padding: 12, borderRadius: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, lineHeight: 1.8, margin: 0 }}>
                {t.pinSetupReason1}<br />
                {t.pinSetupReason2}<br />
                {t.pinSetupReason3}
              </p>
            </div>
            <div style={{ background: '#fffbeb', padding: 10, borderRadius: 10, marginBottom: 10, border: '1px solid #fde68a' }}>
              <p style={{ fontSize: 10, color: '#92400e', fontWeight: 700, lineHeight: 1.5, margin: 0 }}>{t.pinSetupWarning}</p>
            </div>
            <p style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, marginBottom: 12 }}>{t.pinSetupTip}</p>
            <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" style={{ width: '100%', padding: '14px 16px', fontSize: 28, textAlign: 'center', letterSpacing: '0.5em', border: '2px solid #e5e7eb', borderRadius: 16, outline: 'none', boxSizing: 'border-box', fontWeight: 900 }} />
          </div>
        )}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#4338ca', marginBottom: 16 }}>{t.childrenLabel}</h2>
            {children.map((c, i) => (
              <div key={i} style={{ marginBottom: 14, padding: 12, background: '#f9fafb', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#6b7280' }}>
                    {lang === 'ko' ? `아이 ${i + 1}` : `Child ${i + 1}`}
                  </span>
                  {children.length > 1 && (
                    <button onClick={() => removeChild(i)} style={{ background: '#fef2f2', border: 'none', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700 }}>
                      <Trash2 size={12} /> {t.removeChild}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input placeholder={t.childName} value={c.name} onChange={e => updateChild(i, 'name', e.target.value)} maxLength={15} style={{ flex: 2, padding: '12px', fontSize: 14, border: '2px solid #e5e7eb', borderRadius: 12, outline: 'none', fontWeight: 700, minWidth: 0, boxSizing: 'border-box' }} />
                  <input type="number" placeholder={t.childAge} value={c.age} onChange={e => updateChild(i, 'age', e.target.value)} min={3} max={18} style={{ width: 70, padding: '12px', fontSize: 14, border: '2px solid #e5e7eb', borderRadius: 12, outline: 'none', fontWeight: 700, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', marginBottom: 6 }}>{t.chooseEmoji}</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {FREE_EMOJIS.map(e => (
                      <button key={e.id} onClick={() => updateChild(i, 'emoji', e.emoji)} style={{ padding: '6px 8px', fontSize: 22, background: c.emoji === e.emoji ? '#e0e7ff' : '#fff', border: c.emoji === e.emoji ? '2px solid #4f46e5' : '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer' }}>{e.emoji}</button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {children.length < 3 && (
              <button onClick={addChild} style={{ width: '100%', padding: 12, background: '#eef2ff', border: '2px dashed #c7d2fe', borderRadius: 12, color: '#4f46e5', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>{t.addChild}</button>
            )}
          </div>
        )}
        {step === 5 && (() => {
          const previewItems = (lang === 'ko' ? DEFAULT_SHOP_ITEMS_KO : DEFAULT_SHOP_ITEMS_EN).slice(0, 4);
          return (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#4f46e5', marginBottom: 6 }}>{t.ready}</h1>
                <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t.readyDesc}</p>
              </div>
              <div style={{ background: '#eef2ff', padding: 14, borderRadius: 16, marginTop: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#4338ca', marginBottom: 4 }}>🛒 {t.shopPreviewTitle}</h3>
                <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>{t.shopPreviewDesc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {previewItems.map(item => (
                    <div key={item.id} style={{ background: '#fff', padding: '8px 10px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#374151' }}>{item.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#92400e', background: '#fffbeb', padding: '2px 6px', borderRadius: 6 }}>🪙 {item.price}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fffbeb', padding: 12, borderRadius: 14, marginTop: 10, border: '1px solid #fde68a' }}>
                <h3 style={{ fontSize: 12, fontWeight: 900, color: '#92400e', marginBottom: 4 }}>{t.spouseNoticeTitle}</h3>
                <p style={{ fontSize: 10, color: '#78350f', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{t.spouseNoticeDesc}</p>
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: '14px 0', background: '#f3f4f6', border: 'none', borderRadius: 16, fontWeight: 800, color: '#6b7280', cursor: 'pointer', fontSize: 15 }}>{t.back}</button>
        )}
        <button
          onClick={() => step === 5 ? finish() : setStep(step + 1)}
          disabled={!canProceed()}
          style={{ flex: 2, padding: '14px 0', background: canProceed() ? '#4f46e5' : '#c7d2fe', color: '#fff', border: 'none', borderRadius: 16, fontWeight: 900, cursor: canProceed() ? 'pointer' : 'not-allowed', fontSize: 15, boxShadow: canProceed() ? '0 4px 14px rgba(79,70,229,0.3)' : 'none' }}
        >
          {step === 5 ? t.start : t.next}
        </button>
      </div>
    </div>
  );
}

// === MAIN APP ===
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [familyData, setFamilyData] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dataFromServer, setDataFromServer] = useState(false);
  const [todayDate, setTodayDate] = useState(getToday());
  const [lang, setLang] = useState(detectLanguage());

  // 날짜 자동 갱신
  useEffect(() => {
    const checkDate = () => {
      const newToday = getToday();
      if (newToday !== todayDate) setTodayDate(newToday);
    };
    const handleVis = () => { if (!document.hidden) checkDate(); };
    document.addEventListener('visibilitychange', handleVis);
    const interval = setInterval(checkDate, 60000);
    return () => { document.removeEventListener('visibilitychange', handleVis); clearInterval(interval); };
  }, [todayDate]);

  // 날짜 바뀌면 미션 리셋: repeat:true는 completed=false, repeat:false는 제거
  useEffect(() => {
    if (!familyData || !dataFromServer) return;
    const missions = familyData.dailyMissions || [];
    if (missions.length === 0) return;
    const lastResetDate = familyData.missionsLastReset || '';
    if (lastResetDate === todayDate) return;
    const newMissions = missions
      .filter(m => m.repeat)
      .map(m => ({ ...m, completed: false, completedAt: null }));
    saveFamilyData({ ...familyData, dailyMissions: newMissions, missionsLastReset: todayDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDate, dataFromServer]);

  // Mission Manager 열 때 기존 미션 복사
  useEffect(() => {
    if (showMissionManager && familyData) {
      setEditingMissions((familyData.dailyMissions || []).map(m => ({ ...m })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMissionManager]);

  const [currentTab, setCurrentTab] = useState('bag');
  const [showConfetti, setShowConfetti] = useState(false);
  const [couponIndexToUse, setCouponIndexToUse] = useState(null);
  const [showParentModal, setShowParentModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [showShopManager, setShowShopManager] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showRankGuide, setShowRankGuide] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideTab, setGuideTab] = useState('parent');
  const [showEmojiShop, setShowEmojiShop] = useState(false);
  const [showMissionManager, setShowMissionManager] = useState(false);
  const [editingMissions, setEditingMissions] = useState([]);
  const [missionNameInputs, setMissionNameInputs] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showFirstMissionCelebration, setShowFirstMissionCelebration] = useState(false);
  const [message, setMessage] = useState('');

  const t = translations[lang];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) { setIsLoaded(true); return; }
    const ref = doc(db, FIRESTORE_COLLECTION, user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setFamilyData(data);
        if (data.language) setLang(data.language);
      } else {
        setFamilyData(null);
      }
      setDataFromServer(true);
      setIsLoaded(true);
    }, (error) => {
      console.error("Firestore load error:", error);
      setIsLoaded(true);
    });
    return () => unsub();
  }, [user]);

  // 홈 화면 추가 안내 — 팝업은 제거됨. 설치 방법은 사용 설명서에 포함.
  // (useEffect 유지하되 실제 팝업은 띄우지 않음)
  useEffect(() => {
    // 팝업 비활성화: 사용 설명서에서 안내
    return;
  }, [familyData, dataFromServer]);

  const saveFamilyData = useCallback(async (newData) => {
    setFamilyData(newData);
    if (user && dataFromServer) {
      try {
        await setDoc(doc(db, FIRESTORE_COLLECTION, user.uid), newData, { merge: true });
      } catch (e) { console.error("Save failed:", e); }
    }
  }, [user, dataFromServer]);

  const triggerAlert = useCallback((text) => { setMessage(text); setTimeout(() => setMessage(''), 3000); }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { console.error(e); triggerAlert('Login failed'); }
  };
  const handleLogout = async () => { await signOut(auth); };

  const completeOnboarding = (data) => { saveFamilyData(data); };

  // --- Actions ---
  const updatePlayer = (playerName, updater) => {
    const newPlayers = { ...familyData.players };
    newPlayers[playerName] = updater(newPlayers[playerName]);
    saveFamilyData({ ...familyData, players: newPlayers });
  };

  // 개별 미션 승인: missionId로 특정 미션을 완료 처리
  const handleApproveMission = (missionId) => {
    const missions = familyData.dailyMissions || [];
    const mission = missions.find(m => m.id === missionId);
    if (!mission || mission.completed) return;
    
    const p = familyData.players[familyData.activeUser];
    const hist = p.history || [];
    // 가족 전체에서 첫 미션인지 확인
    const isFirstEverMission = Object.values(familyData.players).every(pl => 
      !(pl.history || []).some(h => h.type === 'daily')
    );
    const inv = normalizeInventory(p.inventory);
    const missionCoins = parseInt(mission.coins) || 30;
    let nExp = p.exp + 20, nLv = p.level, nCoins = p.coins + missionCoins, leveled = false;
    if (nExp >= 100) { nExp = 0; nLv += 1; leveled = true; }
    else if (!isFirstEverMission) triggerAlert(t.missionApproved);
    
    const rewardName = mission.reward || t.missionDefaultName;
    const entry = { id: Date.now(), date: todayDate, type: 'daily', description: `${mission.name} → ${rewardName}`, rewards: `🪙 ${missionCoins}`, levelAfter: nLv };
    
    // 플레이어 업데이트 + 미션 완료 표시
    const newPlayers = { ...familyData.players };
    newPlayers[familyData.activeUser] = { 
      ...p, 
      inventory: [...inv, { name: rewardName, icon: '🎫' }], 
      exp: nExp, 
      level: nLv, 
      coins: nCoins, 
      history: [...hist, entry] 
    };
    const newMissions = missions.map(m => 
      m.id === missionId ? { ...m, completed: true, completedAt: Date.now() } : m
    );
    saveFamilyData({ ...familyData, players: newPlayers, dailyMissions: newMissions });
    
    if (isFirstEverMission) {
      playSound('levelUp');
      setShowFirstMissionCelebration(true);
      setTimeout(() => setShowFirstMissionCelebration(false), 4500);
    } else if (leveled) {
      playSound('levelUp'); setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 4000);
    } else {
      playSound('coupon');
    }
  };


  const handleUndoDailyMission = () => {
    const p = familyData.players[familyData.activeUser];
    const inv = normalizeInventory(p.inventory);
    if (inv.length <= 0) { triggerAlert(t.noCoupons); return; }
    const hist = p.history || [];
    let nExp = p.exp - 20, nLv = p.level, nCoins = Math.max(0, p.coins - 50);
    if (nExp < 0) { if (nLv > 1) { nLv -= 1; nExp = 100 + nExp; } else nExp = 0; }
    const nInv = [...inv]; nInv.pop();
    const nHist = [...hist];
    for (let i = nHist.length - 1; i >= 0; i--) { if (nHist[i].type === 'daily') { nHist.splice(i, 1); break; } }
    updatePlayer(familyData.activeUser, (up) => ({ ...up, inventory: nInv, exp: nExp, level: nLv, coins: nCoins, history: nHist }));
    setShowParentModal(false);
    triggerAlert(t.missionCancelled);
  };

  const handleManualStat = (eD, cD, msg) => {
    const p = familyData.players[familyData.activeUser];
    let nExp = p.exp + eD, nLv = p.level, nCoins = Math.max(0, p.coins + cD), leveled = false;
    if (eD > 0 && nExp >= 100) { nExp = 0; nLv += 1; leveled = true; }
    else if (eD < 0 && nExp < 0) { if (nLv > 1) { nLv -= 1; nExp = 100 + nExp; } else nExp = 0; }
    updatePlayer(familyData.activeUser, (up) => ({ ...up, exp: nExp, level: nLv, coins: nCoins }));
    triggerAlert(msg);
    if (leveled) { playSound('levelUp'); setShowLevelUp(true); setTimeout(() => setShowLevelUp(false), 4000); }
  };

  const handleManualCoupon = (d, msg) => {
    const p = familyData.players[familyData.activeUser];
    const inv = normalizeInventory(p.inventory);
    let nInv = [...inv];
    if (d > 0) nInv.push({ name: t.completeDailyMission, icon: '🎮' });
    else if (d < 0) { if (nInv.length === 0) { triggerAlert(t.noCoupons); return; } nInv.pop(); }
    updatePlayer(familyData.activeUser, (up) => ({ ...up, inventory: nInv }));
    triggerAlert(msg);
  };

  const handleBuyItem = (item) => {
    const p = familyData.players[familyData.activeUser];
    if (p.coins < item.price) return;
    const inv = normalizeInventory(p.inventory);
    const hist = p.history || [];
    const entry = { id: Date.now(), date: todayDate, type: 'purchase', description: `${t.purchased}${item.name}`, rewards: `-${item.price}` };
    updatePlayer(familyData.activeUser, (up) => ({ ...up, coins: up.coins - item.price, inventory: [...inv, { name: item.name, icon: item.icon }], history: [...hist, entry] }));
    playSound('coupon'); triggerAlert(`${t.purchased}${item.name}! 🎉`);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === familyData.pin) { setShowPinModal(false); setPinInput(''); setShowParentModal(true); }
    else { triggerAlert(t.accessDenied); setPinInput(''); }
  };

  const handleUseCoupon = () => {
    const p = familyData.players[familyData.activeUser];
    const inv = normalizeInventory(p.inventory);
    if (couponIndexToUse !== null && couponIndexToUse < inv.length) {
      const used = inv[couponIndexToUse];
      const nInv = [...inv]; nInv.splice(couponIndexToUse, 1);
      const hist = p.history || [];
      const entry = { id: Date.now(), date: todayDate, type: 'used', description: used.name, rewards: '' };
      updatePlayer(familyData.activeUser, (up) => ({ ...up, inventory: nInv, history: [...hist, entry] }));
      playSound('coupon'); setShowConfetti(true); setCouponIndexToUse(null); triggerAlert(t.couponUsed);
    }
  };

  const saveShopItem = (item) => {
    const items = familyData.shopItems || [];
    let newItems;
    if (item.id && items.find(i => i.id === item.id)) {
      newItems = items.map(i => i.id === item.id ? item : i);
    } else {
      newItems = [...items, { ...item, id: 'i' + Date.now() }];
    }
    saveFamilyData({ ...familyData, shopItems: newItems });
    setEditingItem(null);
  };

  const deleteShopItem = (id) => {
    const newItems = (familyData.shopItems || []).filter(i => i.id !== id);
    saveFamilyData({ ...familyData, shopItems: newItems });
  };

  const handleResetFamily = async () => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, FIRESTORE_COLLECTION, user.uid));
      setFamilyData(null);
      setShowResetConfirm(false);
      setShowParentModal(false);
      setShowShopManager(false);
    } catch (e) {
      console.error("Reset failed:", e);
      triggerAlert('Reset failed. Please try again.');
    }
  };

  // --- Loading ---
  if (authLoading || (user && !isLoaded)) {
    return (
      <div style={{ minHeight: '100vh', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 48, height: 48, border: '4px solid #c7d2fe', borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // --- Login ---
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '32px 20px 40px', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet" />
        <button onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')} style={{ position: 'absolute', top: 20, right: 20, background: '#fff', border: '1px solid #c7d2fe', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 800, color: '#4f46e5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Globe size={12} /> {t.languageToggle}
        </button>
        <div style={{ fontSize: 56, marginBottom: 10 }}>⚔️</div>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: '#4f46e5', marginBottom: 10, textAlign: 'center' }}>{t.appName}</h1>
        <p style={{ color: '#4338ca', fontWeight: 700, marginBottom: 4, textAlign: 'center', maxWidth: 340, fontSize: 14 }}>
          {lang === 'ko' ? '잔소리 없는 습관 만들기' : 'Build Habits Without Nagging'}
        </p>
        <p style={{ color: '#6b7280', fontWeight: 600, marginBottom: 24, textAlign: 'center', maxWidth: 340, fontSize: 12, lineHeight: 1.6 }}>
          {lang === 'ko' 
            ? '아이가 미션을 완료하면 부모가 승인하고, 코인을 모아 실제 보상(간식, 영화, 나들이 등)으로 교환하는 가족용 앱입니다.'
            : 'Kids complete missions, parents approve, coins are exchanged for real rewards (snacks, movies, outings) you set up.'}
        </p>

        <button onClick={handleLogin} style={{ background: '#fff', border: '2px solid #e5e7eb', padding: '14px 28px', borderRadius: 16, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 7.1 29.3 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.8 44 30.3 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
          {t.signInGoogle}
        </button>
        <p style={{ marginTop: 14, fontSize: 10, color: '#9ca3af', textAlign: 'center', maxWidth: 280 }}>
          {lang === 'ko' ? '로그인하시면 ' : 'By signing in, you agree to our '}
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'underline', fontWeight: 700 }}>
            {lang === 'ko' ? '개인정보 처리방침' : 'Privacy Policy'}
          </a>
          {lang === 'ko' ? '에 동의하는 것으로 간주됩니다.' : '.'}
        </p>

        {/* Safety info card */}
        <div style={{ marginTop: 24, background: '#fff', borderRadius: 20, padding: 18, maxWidth: 360, width: '100%', border: '1px solid #e0e7ff' }}>
          <h3 style={{ fontSize: 13, fontWeight: 900, color: '#4338ca', marginBottom: 10 }}>{t.safetyTitle}</h3>
          <div style={{ fontSize: 11, color: '#4b5563', fontWeight: 600, lineHeight: 1.7 }}>
            <p style={{ marginBottom: 6 }}>✅ {t.safetyCollect}</p>
            <p style={{ marginBottom: 6 }}>❌ {t.safetyNotCollect}</p>
            <p style={{ marginBottom: 6 }}>🗄️ {t.safetyStorage}</p>
            <p style={{ marginBottom: 6 }}>🌐 {t.safetyNoInstall}</p>
            <p style={{ marginBottom: 6 }}>💰 {t.safetyFreePrice}</p>
            <p>
              📂 <a href="https://github.com/shinnn2/levelup-home" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'underline', fontWeight: 700 }}>{t.safetyOpenSource}</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Onboarding (new family) ---
  if (!familyData) {
    return <Onboarding lang={lang} setLang={setLang} onComplete={completeOnboarding} />;
  }

  // --- Main App ---
  const activeUser = familyData.activeUser;
  const cur = familyData.players[activeUser];
  const curTitle = getTitle(cur.level, t);
  const curInv = normalizeInventory(cur.inventory);
  const curHist = cur.history || [];
  const isTodayDone = curHist.some(h => h.date === todayDate && h.type === 'daily');
  const playerNames = Object.keys(familyData.players);
  const shopItems = familyData.shopItems || [];

  return (
    <div style={{ minHeight: '100vh', background: '#eef2ff', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", color: '#1f2937', paddingBottom: 100, userSelect: 'none' }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet" />
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

      {showLevelUp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <Confetti onComplete={() => {}} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>🌟</div>
            <h1 style={{ fontSize: 44, fontWeight: 900, background: 'linear-gradient(90deg, #fde68a, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textTransform: 'uppercase', fontStyle: 'italic' }}>{t.levelUp}</h1>
            <p style={{ fontSize: 18, color: '#fff', fontWeight: 700, background: 'rgba(79,70,229,0.5)', padding: '8px 24px', borderRadius: 50, marginTop: 8 }}>{activeUser} {t.nowLv} {cur.level}!</p>
          </div>
        </div>
      )}

      {showFirstMissionCelebration && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: 24 }}>
          <Confetti onComplete={() => {}} />
          <div style={{ background: '#fff', borderRadius: 32, padding: '36px 28px', textAlign: 'center', maxWidth: 360, boxShadow: '0 20px 60px rgba(79,70,229,0.4)', border: '4px solid #fde68a' }}>
            <div style={{ fontSize: 72, marginBottom: 12 }}>🎊</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, background: 'linear-gradient(90deg, #f59e0b, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 14, lineHeight: 1.3 }}>
              {lang === 'ko' ? '첫 미션 완료!' : 'First Mission Complete!'}
            </h1>
            <p style={{ fontSize: 14, color: '#4338ca', fontWeight: 700, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{t.firstMissionCelebration}</p>
            <div style={{ marginTop: 18, padding: '10px 14px', background: '#eef2ff', borderRadius: 12, display: 'inline-block' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#4f46e5' }}>+20 EXP · +50 🪙 · +1 🎟️</span>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#fff', border: '2px solid #a5b4fc', padding: '10px 20px', borderRadius: 50, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✨</span><span style={{ fontWeight: 700, color: '#4338ca', fontSize: 13 }}>{message}</span>
        </div>
      )}

      <header style={{ background: '#fff', padding: '12px 16px 8px', borderBottom: '1px solid #e0e7ff', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <button onClick={() => { const nl = lang === 'ko' ? 'en' : 'ko'; setLang(nl); saveFamilyData({ ...familyData, language: nl }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Globe size={14} /> {t.languageToggle}
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#4f46e5', letterSpacing: 0.5, fontStyle: 'italic' }}>⚔️ {familyData.familyName || t.appName}</h1>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}><LogOut size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {playerNames.map(n => {
            const g = getTitle(familyData.players[n].level, t).gear;
            const act = activeUser === n;
            const emoji = familyData.players[n].emoji || '🐱';
            return (
              <button key={n} onClick={() => saveFamilyData({ ...familyData, activeUser: n })} style={{ padding: '8px 14px', borderRadius: '14px 14px 0 0', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: act ? '#4f46e5' : '#e0e7ff', color: act ? '#fff' : '#818cf8' }}>
                <span style={{ fontSize: 14 }}>{emoji}</span> {n} {g && <span>{g}</span>} ({familyData.players[n].age})
              </button>
            );
          })}
        </div>
      </header>

      <section style={{ padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <button onClick={() => setShowEmojiShop(true)} style={{ fontSize: 56, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }} title={t.changeEmoji}>{cur.emoji || '🐱'}</button>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginTop: 4 }}>{t.changeEmoji} ✨</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={() => setShowRankGuide(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                {t.warriorRank} <span style={{ fontSize: 10 }}>ⓘ</span>
              </span>
              <div><span style={{ fontSize: 17, fontWeight: 900, color: '#4338ca' }}>{curTitle.text}</span> <span style={{ fontSize: 20 }}>{curTitle.emoji}</span></div>
            </button>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 2 }}>{t.level}</span>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#4f46e5', fontStyle: 'italic' }}>Lv {cur.level}</div>
            </div>
          </div>
          {(() => {
            const nextRank = getNextRankInfo(cur.level);
            if (!nextRank) {
              return (
                <div style={{ marginBottom: 12, padding: '6px 12px', background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>👑</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e' }}>{t.maxRank}</span>
                </div>
              );
            }
            return (
              <button onClick={() => setShowRankGuide(true)} style={{ marginBottom: 12, padding: '6px 12px', background: '#eef2ff', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', width: '100%' }}>
                <span style={{ fontSize: 13 }}>{nextRank.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#4338ca' }}>
                  {t.nextRank}: {t[nextRank.key]} (Lv {nextRank.minLevel}) — {nextRank.levelsRemaining} {t.levelsToGo}
                </span>
              </button>
            );
          })()}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 900, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}><span>{t.experience}</span><span>{cur.exp} / 100</span></div>
            <div style={{ width: '100%', height: 14, background: '#f3f4f6', borderRadius: 50, overflow: 'hidden', padding: 2 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #818cf8, #a78bfa)', borderRadius: 50, transition: 'width 0.5s', width: `${cur.exp}%` }} />
            </div>
          </div>
          <button onClick={() => { setCurrentTab('shop'); triggerAlert(t.coinTapHint); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight * 0.3, behavior: 'smooth' }), 100); }} style={{ display: 'flex', alignItems: 'center', background: '#fffbeb', padding: '8px 16px', borderRadius: 16, border: '1px solid #fde68a', cursor: 'pointer' }}>
            <span style={{ fontSize: 17, marginRight: 8 }}>🪙</span><span style={{ fontWeight: 900, color: '#92400e' }}>{cur.coins}</span>
          </button>
          <div style={{ marginTop: 12 }}>
            {(() => {
              const missions = familyData.dailyMissions || [];
              if (missions.length === 0) {
                return (
                  <div style={{ padding: '12px 14px', borderRadius: 14, background: '#f9fafb', border: '1px dashed #d1d5db', textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>{t.missionListEmpty}</p>
                  </div>
                );
              }
              const completedCount = missions.filter(m => m.completed).length;
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 10, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: 1 }}>🌟 {t.missionsToday}</label>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#4f46e5' }}>{completedCount}/{missions.length} {t.missionProgress}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {missions.map(m => (
                      <div key={m.id} style={{
                        padding: '8px 12px',
                        borderRadius: 12,
                        background: m.completed ? '#f0fdf4' : '#fffbeb',
                        border: `1px solid ${m.completed ? '#bbf7d0' : '#fde68a'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}>
                        <span style={{ fontSize: 16 }}>{m.completed ? '✅' : '☐'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: m.completed ? '#16a34a' : '#78350f', textDecoration: m.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                          <div style={{ fontSize: 10, color: m.completed ? '#16a34a' : '#b45309', fontWeight: 600, marginTop: 2 }}>🎫 {m.reward} · 🪙 {m.coins}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {completedCount < missions.length && (
                    <p style={{ fontSize: 10, color: '#b45309', fontWeight: 600, marginTop: 8, lineHeight: 1.5, textAlign: 'center' }}>{t.missionTapHint}</p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      <div style={{ padding: '0 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => setShowGuide(true)} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#4f46e5', fontSize: 11, fontWeight: 800, padding: '6px 12px', borderRadius: 14 }}>
          📘 {t.guide}
        </button>
        <button onClick={() => setShowPinModal(true)} style={{ background: '#fff', border: '1px solid #c7d2fe', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#4f46e5', fontSize: 11, fontWeight: 800, padding: '6px 12px', borderRadius: 14 }}>
          <Settings size={14} />{t.parentZone}
        </button>
      </div>

      <main style={{ padding: '0 16px' }}>
        {currentTab === 'bag' && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Gift size={20} color="#4f46e5" /> {t.myBag} <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>{t.total} {curInv.length}</span>
            </h2>
            {curInv.length > 0 ? curInv.map((item, i) => (
              <button key={i} onClick={() => setCouponIndexToUse(i)} style={{ width: '100%', background: '#fff', padding: 16, borderRadius: 24, border: '2px solid #e0e7ff', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 50, height: 50, background: '#eef2ff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{item.icon || '🎮'}</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: 900, color: '#4338ca', fontSize: 13 }}>{item.name}</h3>
                  <p style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>{t.readyToUse}</p>
                </div>
                <div style={{ background: '#4f46e5', color: '#fff', padding: 8, borderRadius: 12 }}><Check size={16} /></div>
              </button>
            )) : (
              <div style={{ border: '2px dashed #d1d5db', borderRadius: 24, padding: 40, textAlign: 'center', opacity: 0.6 }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>🎒</div>
                <p style={{ fontWeight: 700, color: '#9ca3af', fontSize: 13 }}>{t.bagEmpty}</p>
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{t.bagEmptyDesc}</p>
              </div>
            )}
          </div>
        )}

        {currentTab === 'history' && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Clock size={20} color="#4f46e5" /> {t.history} <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>{curHist.length} {t.records}</span>
            </h2>
            {curHist.length > 0 ? [...curHist].reverse().map((h) => {
              const cfg = h.type === 'daily' ? { icon: '🌟', color: '#4338ca', bg: '#eef2ff' } : h.type === 'purchase' ? { icon: '🛒', color: '#b45309', bg: '#fffbeb' } : { icon: '🎉', color: '#059669', bg: '#ecfdf5' };
              return (
                <div key={h.id} style={{ background: '#fff', padding: 12, borderRadius: 18, border: '1px solid #f3f4f6', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: cfg.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 800, color: cfg.color, fontSize: 12 }}>{h.description}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>{h.date} {h.rewards && `· ${h.rewards}`}</span>
                  </div>
                </div>
              );
            }) : <div style={{ border: '2px dashed #d1d5db', borderRadius: 24, padding: 40, textAlign: 'center', opacity: 0.6 }}><div style={{ fontSize: 36 }}>📜</div><p style={{ fontWeight: 700, color: '#9ca3af', fontSize: 13, marginTop: 14 }}>{t.historyEmpty}</p></div>}
          </div>
        )}

        {currentTab === 'shop' && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <ShoppingBag size={20} color="#4f46e5" /> {t.rewardShop}
            </h2>
            {shopItems.map(item => {
              const lock = cur.level < item.minLevel;
              const afford = cur.coins >= item.price;
              return (
                <div key={item.id} style={{ background: '#fff', padding: 14, borderRadius: 20, border: '2px solid #e0e7ff', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: lock ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: lock ? '#f3f4f6' : '#eef2ff' }}>{item.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontWeight: 900, fontSize: 12, color: '#4338ca', lineHeight: 1.3 }}>{item.name}</h4>
                      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fffbeb', padding: '2px 6px', borderRadius: 6 }}>🪙 {item.price}</span>
                        {lock && <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', background: '#fef2f2', padding: '2px 6px', borderRadius: 6 }}>Lv {item.minLevel}+</span>}
                      </div>
                    </div>
                  </div>
                  <button disabled={lock || !afford} onClick={() => handleBuyItem(item)} style={{ padding: '8px 14px', borderRadius: 14, fontWeight: 900, border: 'none', cursor: lock || !afford ? 'not-allowed' : 'pointer', fontSize: 12, background: lock ? '#f3f4f6' : afford ? '#4f46e5' : '#e5e7eb', color: lock ? '#9ca3af' : afford ? '#fff' : '#9ca3af', marginLeft: 8 }}>
                    {lock ? '🔒' : t.buy}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Use Coupon Modal */}
      {couponIndexToUse !== null && curInv[couponIndexToUse] && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(49,46,129,0.4)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 32, maxWidth: 340, width: '100%', padding: 28, textAlign: 'center' }}>
            <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px' }}>{curInv[couponIndexToUse].icon || '🎮'}</div>
            <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>{t.useCoupon}</h3>
            <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 700, marginBottom: 20 }}>{curInv[couponIndexToUse].name}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCouponIndexToUse(null)} style={{ flex: 1, padding: '12px 0', background: '#f3f4f6', borderRadius: 14, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer' }}>{t.notNow}</button>
              <button onClick={handleUseCoupon} style={{ flex: 1, padding: '12px 0', background: '#4f46e5', color: '#fff', borderRadius: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{t.yesUse}</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(12px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 32, maxWidth: 320, width: '100%', padding: 28, textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>🔒</div>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>{t.parentOnly}</h3>
            <form onSubmit={handlePinSubmit}>
              <input type="password" inputMode="numeric" maxLength="4" autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} style={{ width: '100%', textAlign: 'center', fontSize: 26, letterSpacing: '0.6em', fontWeight: 900, background: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: 14, padding: '12px 0', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} placeholder="••••" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setShowPinModal(false); setPinInput(''); }} style={{ flex: 1, padding: '12px 0', background: '#f3f4f6', borderRadius: 14, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer' }}>{t.cancel}</button>
                <button type="submit" style={{ flex: 1, padding: '12px 0', background: '#4f46e5', color: '#fff', borderRadius: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{t.unlock}</button>
              </div>
            </form>
            <button type="button" onClick={() => { setShowPinModal(false); setPinInput(''); setShowForgotPinModal(true); }} style={{ marginTop: 14, background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>{t.forgotPin}</button>
          </div>
        </div>
      )}

      {/* Forgot PIN Modal */}
      {showForgotPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.65)', backdropFilter: 'blur(12px)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 28, maxWidth: 360, width: '100%', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📧</div>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#4338ca', marginBottom: 10 }}>{t.pinResetConfirmTitle}</h3>
            <p style={{ fontSize: 12, color: '#4b5563', fontWeight: 600, lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-line', textAlign: 'left' }}>{t.pinResetConfirmDesc}</p>
            <div style={{ background: '#eef2ff', padding: '12px 16px', borderRadius: 12, marginBottom: 12, border: '1px solid #c7d2fe' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#4338ca', letterSpacing: 0.5 }}>{t.pinResetEmail}</span>
            </div>
            <button onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(t.pinResetEmail).then(() => {
                  triggerAlert(t.pinResetEmailCopied);
                }).catch(() => {
                  triggerAlert(t.pinResetEmail);
                });
              } else {
                triggerAlert(t.pinResetEmail);
              }
            }} style={{ width: '100%', padding: '12px 0', background: '#4f46e5', color: '#fff', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>
              {t.pinResetCopyEmail}
            </button>
            <button onClick={() => setShowForgotPinModal(false)} style={{ width: '100%', padding: '12px 0', background: '#f3f4f6', borderRadius: 12, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer' }}>{t.close}</button>
          </div>
        </div>
      )}

      {/* Parent Zone Modal */}
      {showParentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(12px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 32, maxWidth: 360, width: '100%', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, textAlign: 'center', marginBottom: 4 }}>{t.parentZone}</h3>
            <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>{t.manage}{activeUser}</p>
            <div style={{ background: '#fffbeb', padding: 14, borderRadius: 20, border: '2px solid #fde68a', marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>{t.manualAdjust}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {[
                  { l: '+20 EXP', c: '#4f46e5', a: () => handleManualStat(20, 0, '+20 EXP ✨') },
                  { l: '-20 EXP', c: '#ef4444', a: () => handleManualStat(-20, 0, '-20 EXP 📉') },
                  { l: '+50 🪙', c: '#b45309', a: () => handleManualStat(0, 50, '+50 🪙') },
                  { l: '-50 🪙', c: '#ef4444', a: () => handleManualStat(0, -50, '-50 🪙') },
                  { l: '+🎟️', c: '#7c3aed', a: () => handleManualCoupon(1, '+1 🎟️') },
                  { l: '-🎟️', c: '#ef4444', a: () => handleManualCoupon(-1, '-1 🎟️') },
                ].map((b, i) => <button key={i} onClick={b.a} style={{ padding: '10px 0', background: '#fff', color: b.c, borderRadius: 12, fontWeight: 900, fontSize: 11, border: '1px solid #e5e7eb', cursor: 'pointer' }}>{b.l}</button>)}
              </div>
            </div>
            {(() => {
              const missions = familyData.dailyMissions || [];
              const pendingMissions = missions.filter(m => !m.completed);
              if (missions.length === 0) return null;
              return (
                <div style={{ background: '#fffbeb', padding: 12, borderRadius: 16, border: '2px solid #fde68a', marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>🌟 {t.missionsToday} ({pendingMissions.length})</div>
                  {pendingMissions.length === 0 ? (
                    <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, textAlign: 'center', margin: 0, padding: 8 }}>✅ {t.missionDone}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pendingMissions.map(m => (
                        <div key={m.id} style={{ background: '#fff', padding: '8px 10px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#78350f', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                            <div style={{ fontSize: 9, color: '#b45309', fontWeight: 600, marginTop: 1 }}>🎫 {m.reward} · 🪙 {m.coins}</div>
                          </div>
                          <button onClick={() => handleApproveMission(m.id)} style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 10, fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>{t.approveMission}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <button onClick={() => { setShowParentModal(false); setShowMissionManager(true); }} style={{ width: '100%', padding: 12, background: '#fef3c7', borderRadius: 14, fontWeight: 800, color: '#b45309', border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>{t.manageMissions}</button>
            <button onClick={() => { setShowParentModal(false); setShowShopManager(true); }} style={{ width: '100%', padding: 12, background: '#e0e7ff', borderRadius: 14, fontWeight: 800, color: '#4338ca', border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>{t.manageShop}</button>
            <button onClick={() => setShowResetConfirm(true)} style={{ width: '100%', padding: 12, background: '#fef2f2', borderRadius: 14, fontWeight: 800, color: '#dc2626', border: '1px solid #fecaca', cursor: 'pointer', fontSize: 12, marginBottom: 8 }}>{t.resetFamily}</button>
            <button onClick={() => setShowParentModal(false)} style={{ width: '100%', padding: 12, background: '#f3f4f6', borderRadius: 14, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer' }}>{t.close}</button>
          </div>
        </div>
      )}

      {/* Mission Manager */}
      {showMissionManager && (() => {
        const favs = familyData.favoriteRewards || [];
        const addMission = () => {
          if (editingMissions.length >= 5) { triggerAlert(t.maxMissionsReached); return; }
          setEditingMissions([...editingMissions, { id: Date.now() + Math.random(), name: '', reward: '', coins: 30, repeat: false, completed: false }]);
        };
        const updateMission = (id, field, value) => {
          setEditingMissions(editingMissions.map(m => m.id === id ? { ...m, [field]: value } : m));
        };
        const removeMission = (id) => setEditingMissions(editingMissions.filter(m => m.id !== id));
        const saveMissions = () => {
          const valid = editingMissions.filter(m => m.name.trim() && m.reward.trim());
          const existing = familyData.dailyMissions || [];
          const merged = valid.map(m => {
            const oldM = existing.find(em => em.id === m.id);
            return oldM ? { ...m, completed: oldM.completed, completedAt: oldM.completedAt } : { ...m, completed: false, completedAt: null };
          });
          const newRewards = valid.map(m => m.reward.trim());
          const updatedFavs = [...new Set([...newRewards, ...favs])].slice(0, 10);
          saveFamilyData({ ...familyData, dailyMissions: merged, favoriteRewards: updatedFavs, missionsLastReset: todayDate });
          setShowMissionManager(false);
          setEditingMissions([]);
          triggerAlert(t.missionsSaved);
        };
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(12px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 28, maxWidth: 420, width: '100%', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ fontSize: 17, fontWeight: 900, marginBottom: 12, textAlign: 'center', color: '#4338ca' }}>{t.manageMissions}</h3>
              <button onClick={addMission} disabled={editingMissions.length >= 5} style={{ width: '100%', padding: 10, background: editingMissions.length >= 5 ? '#e5e7eb' : '#4f46e5', color: '#fff', borderRadius: 12, fontWeight: 800, border: 'none', cursor: editingMissions.length >= 5 ? 'not-allowed' : 'pointer', marginBottom: 12, fontSize: 13 }}>{t.addMission} ({editingMissions.length}/5)</button>
              
              {editingMissions.map((m, idx) => (
                <div key={m.id} style={{ background: '#f9fafb', padding: 12, borderRadius: 14, marginBottom: 10, border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#6b7280' }}>#{idx + 1}</span>
                    <button onClick={() => removeMission(m.id)} style={{ background: '#fef2f2', border: 'none', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', color: '#ef4444', fontSize: 10, fontWeight: 700 }}>
                      <Trash2 size={12} style={{ verticalAlign: 'middle' }} />
                    </button>
                  </div>
                  <input value={m.name} onChange={e => updateMission(m.id, 'name', e.target.value)} placeholder={t.missionName} maxLength={40} style={{ width: '100%', padding: 9, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 6, outline: 'none', boxSizing: 'border-box', fontWeight: 700 }} />
                  <input value={m.reward} onChange={e => updateMission(m.id, 'reward', e.target.value)} placeholder={t.missionReward} maxLength={40} style={{ width: '100%', padding: 9, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 6, outline: 'none', boxSizing: 'border-box', fontWeight: 700 }} />
                  {favs.length > 0 && (
                    <select onChange={e => { if (e.target.value) updateMission(m.id, 'reward', e.target.value); e.target.value = ''; }} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 6, background: '#fff', color: '#6b7280', fontWeight: 600 }}>
                      <option value="">💡 {t.favoriteRewardsLabel}</option>
                      {favs.map((r, i) => <option key={i} value={r}>{r}</option>)}
                    </select>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input type="number" value={m.coins} onChange={e => updateMission(m.id, 'coins', parseInt(e.target.value) || 0)} min={0} max={999} style={{ width: 80, padding: 9, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 10, outline: 'none', boxSizing: 'border-box', fontWeight: 700, textAlign: 'center' }} />
                    <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, alignSelf: 'center' }}>🪙 {t.missionCoins}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => updateMission(m.id, 'repeat', false)} style={{ flex: 1, padding: 8, background: !m.repeat ? '#4f46e5' : '#f3f4f6', color: !m.repeat ? '#fff' : '#6b7280', borderRadius: 10, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer' }}>📅 {t.missionOnce}</button>
                    <button onClick={() => updateMission(m.id, 'repeat', true)} style={{ flex: 1, padding: 8, background: m.repeat ? '#4f46e5' : '#f3f4f6', color: m.repeat ? '#fff' : '#6b7280', borderRadius: 10, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer' }}>🔁 {t.missionRepeat}</button>
                  </div>
                </div>
              ))}
              
              <button onClick={saveMissions} style={{ width: '100%', padding: 12, background: '#4f46e5', color: '#fff', borderRadius: 14, fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 8, marginTop: 8 }}>💾 {t.saveMissions}</button>
              <button onClick={() => { setShowMissionManager(false); setEditingMissions([]); }} style={{ width: '100%', padding: 12, background: '#f3f4f6', borderRadius: 14, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer' }}>{t.close}</button>
            </div>
          </div>
        );
      })()}

      {/* Shop Manager */}
      {showShopManager && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(12px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 32, maxWidth: 400, width: '100%', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 12, textAlign: 'center' }}>{t.manageShop}</h3>
            <button onClick={() => setEditingItem({ name: '', price: 100, minLevel: 1, icon: '🎁' })} style={{ width: '100%', padding: 10, background: '#4f46e5', color: '#fff', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer', marginBottom: 12, fontSize: 13 }}>{t.addItem}</button>
            {shopItems.map(item => (
              <div key={item.id} style={{ background: '#f9fafb', padding: 10, borderRadius: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: '#374151' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>🪙 {item.price} · Lv {item.minLevel}+</div>
                </div>
                <button onClick={() => setEditingItem(item)} style={{ background: '#e0e7ff', border: 'none', padding: 6, borderRadius: 8, cursor: 'pointer', color: '#4338ca' }}><Edit2 size={12} /></button>
                <button onClick={() => deleteShopItem(item.id)} style={{ background: '#fef2f2', border: 'none', padding: 6, borderRadius: 8, cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
              </div>
            ))}
            <button onClick={() => setShowShopManager(false)} style={{ width: '100%', padding: 12, background: '#f3f4f6', borderRadius: 14, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer', marginTop: 12 }}>{t.close}</button>
          </div>
        </div>
      )}

      {/* Install Prompt Modal */}
      {showInstallPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', backdropFilter: 'blur(6px)', zIndex: 55, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 28, maxWidth: 380, width: '100%', padding: 22, marginBottom: 80, boxShadow: '0 -10px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>📱</div>
              <h3 style={{ fontSize: 17, fontWeight: 900, color: '#4338ca', marginBottom: 6 }}>{t.installPromptTitle}</h3>
              <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, lineHeight: 1.5 }}>{t.installPromptDesc}</p>
            </div>
            <div style={{ background: '#f9fafb', padding: 12, borderRadius: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#374151', fontWeight: 700, lineHeight: 1.7, margin: 0 }}>
                🍎 {t.installIphone}<br/>
                🤖 {t.installAndroid}<br/>
                💻 {t.installDesktop}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { localStorage.setItem('levelup_install_dismissed', '1'); setShowInstallPrompt(false); }} style={{ flex: 1, padding: 12, background: '#f3f4f6', borderRadius: 12, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer', fontSize: 13 }}>{t.installDone}</button>
              <button onClick={() => { localStorage.setItem('levelup_install_snoozed_until', String(Date.now() + 3 * 24 * 60 * 60 * 1000)); setShowInstallPrompt(false); }} style={{ flex: 1, padding: 12, background: '#4f46e5', color: '#fff', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 13 }}>{t.installLater}</button>
            </div>
          </div>
        </div>
      )}

      {/* Rank Guide Modal */}
      {showRankGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(8px)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 28, maxWidth: 360, width: '100%', padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#4338ca', marginBottom: 16, textAlign: 'center' }}>🏆 {t.rankGuide}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RANK_LEVELS.map((r, idx) => {
                const nextMin = RANK_LEVELS[idx + 1]?.minLevel;
                const isCurrent = cur.level >= r.minLevel && (!nextMin || cur.level < nextMin);
                const range = nextMin ? `Lv ${r.minLevel}–${nextMin - 1}` : `Lv ${r.minLevel}+`;
                return (
                  <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: isCurrent ? '#eef2ff' : '#f9fafb', border: isCurrent ? '2px solid #4f46e5' : '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 26 }}>{r.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: isCurrent ? '#4338ca' : '#374151' }}>{t[r.key]}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', marginTop: 2 }}>{range}</div>
                    </div>
                    {isCurrent && <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', background: '#4f46e5', padding: '3px 8px', borderRadius: 8 }}>{t.currentRank}</span>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowRankGuide(false)} style={{ width: '100%', padding: 12, background: '#f3f4f6', borderRadius: 12, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer', marginTop: 16 }}>{t.close}</button>
          </div>
        </div>
      )}

      {/* Guide Modal */}
      {showGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(8px)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 28, maxWidth: 400, width: '100%', padding: 22, maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#4338ca', marginBottom: 14, textAlign: 'center' }}>📘 {t.guide}</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <button onClick={() => setGuideTab('parent')} style={{ flex: 1, padding: '8px 0', background: guideTab === 'parent' ? '#4f46e5' : '#f3f4f6', color: guideTab === 'parent' ? '#fff' : '#6b7280', borderRadius: 10, fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 12 }}>👨‍👩 {t.guideForParent}</button>
              <button onClick={() => setGuideTab('child')} style={{ flex: 1, padding: '8px 0', background: guideTab === 'child' ? '#4f46e5' : '#f3f4f6', color: guideTab === 'child' ? '#fff' : '#6b7280', borderRadius: 10, fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 12 }}>🧒 {t.guideForChild}</button>
            </div>
            <div style={{ background: '#f9fafb', padding: 14, borderRadius: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: '#374151', fontWeight: 600, lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
                {guideTab === 'parent' ? t.guideParentContent : t.guideChildContent}
              </p>
            </div>
            <button onClick={() => setShowGuide(false)} style={{ width: '100%', padding: 12, background: '#f3f4f6', borderRadius: 12, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer' }}>{t.close}</button>
          </div>
        </div>
      )}

      {/* Emoji Shop Modal */}
      {showEmojiShop && (() => {
        const owned = cur.ownedEmojis || FREE_EMOJI_IDS;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(8px)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 28, maxWidth: 420, width: '100%', padding: 22, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#4338ca', marginBottom: 4, textAlign: 'center' }}>✨ {t.emojiShop}</h3>
              <p style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginBottom: 12, fontWeight: 600 }}>{t.chooseEmojiDesc}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, padding: '8px 14px', background: '#eef2ff', borderRadius: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#4338ca' }}>{activeUser}:</span>
                <span style={{ fontSize: 24 }}>{cur.emoji || '🐱'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280' }}>Lv {cur.level}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#92400e' }}>🪙 {cur.coins}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
                {[1, 5, 10, 20, 50].map(levelTier => {
                  const tierEmojis = EMOJI_CATALOG.filter(e => e.minLevel === levelTier);
                  if (tierEmojis.length === 0) return null;
                  return (
                    <div key={levelTier} style={{ marginBottom: 12 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 900, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {levelTier === 1 ? '🎁 Free' : `Lv ${levelTier}+ · 🪙 ${tierEmojis[0].price}`}
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {tierEmojis.map(e => {
                          const isOwned = owned.includes(e.id);
                          const isActive = cur.emoji === e.emoji;
                          const canUnlock = cur.level >= e.minLevel;
                          const canBuy = canUnlock && !isOwned && cur.coins >= e.price;
                          return (
                            <button
                              key={e.id}
                              onClick={() => {
                                if (isOwned) {
                                  updatePlayer(activeUser, up => ({ ...up, emoji: e.emoji }));
                                  setShowEmojiShop(false);
                                } else if (canBuy) {
                                  updatePlayer(activeUser, up => ({
                                    ...up,
                                    coins: up.coins - e.price,
                                    ownedEmojis: [...(up.ownedEmojis || FREE_EMOJI_IDS), e.id],
                                    emoji: e.emoji,
                                  }));
                                  playSound('coupon');
                                  triggerAlert(`${t.emojiPurchased} ${e.emoji}`);
                                }
                              }}
                              disabled={!isOwned && !canBuy}
                              style={{
                                padding: 8,
                                background: isActive ? '#e0e7ff' : isOwned ? '#fff' : canBuy ? '#fff' : '#f9fafb',
                                border: isActive ? '2px solid #4f46e5' : isOwned ? '1px solid #c7d2fe' : '1px solid #e5e7eb',
                                borderRadius: 10,
                                cursor: isOwned || canBuy ? 'pointer' : 'not-allowed',
                                opacity: !canUnlock ? 0.4 : 1,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                              }}
                            >
                              <span style={{ fontSize: 22 }}>{e.emoji}</span>
                              <span style={{ fontSize: 8, fontWeight: 800, color: isActive ? '#4f46e5' : isOwned ? '#4338ca' : canUnlock ? '#92400e' : '#9ca3af' }}>
                                {isActive ? t.emojiUse : isOwned ? t.emojiOwn : !canUnlock ? `${t.emojiLocked}${e.minLevel}` : `🪙 ${e.price}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setShowEmojiShop(false)} style={{ width: '100%', padding: 12, background: '#f3f4f6', borderRadius: 12, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer' }}>{t.close}</button>
            </div>
          </div>
        );
      })()}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 28, maxWidth: 340, width: '100%', padding: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
              <h3 style={{ fontSize: 17, fontWeight: 900, color: '#dc2626', marginBottom: 10 }}>{t.resetConfirmTitle}</h3>
              <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, lineHeight: 1.6 }}>{t.resetConfirmDesc}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: 12, background: '#f3f4f6', borderRadius: 12, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer' }}>{t.cancel}</button>
              <button onClick={handleResetFamily} style={{ flex: 1, padding: 12, background: '#dc2626', color: '#fff', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer' }}>{t.resetConfirmButton}</button>
            </div>
          </div>
        </div>
      )}

      {/* Item Editor */}
      {editingItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 28, maxWidth: 340, width: '100%', padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 14, textAlign: 'center' }}>{editingItem.id ? t.editItem : t.addItem}</h3>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#6b7280', marginBottom: 4 }}>{t.itemName}</label>
            <input value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} maxLength={40} style={{ width: '100%', padding: 10, fontSize: 14, border: '2px solid #e5e7eb', borderRadius: 10, outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontWeight: 700 }} />
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#6b7280', marginBottom: 4 }}>{t.itemIcon}</label>
            <input value={editingItem.icon} onChange={e => setEditingItem({ ...editingItem, icon: e.target.value })} maxLength={4} style={{ width: '100%', padding: 10, fontSize: 22, textAlign: 'center', border: '2px solid #e5e7eb', borderRadius: 10, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#6b7280', marginBottom: 4 }}>{t.itemPrice}</label>
                <input type="number" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: 10, fontSize: 14, border: '2px solid #e5e7eb', borderRadius: 10, outline: 'none', boxSizing: 'border-box', fontWeight: 700 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#6b7280', marginBottom: 4 }}>{t.itemMinLevel}</label>
                <input type="number" value={editingItem.minLevel} onChange={e => setEditingItem({ ...editingItem, minLevel: parseInt(e.target.value) || 1 })} min={1} style={{ width: '100%', padding: 10, fontSize: 14, border: '2px solid #e5e7eb', borderRadius: 10, outline: 'none', boxSizing: 'border-box', fontWeight: 700 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setEditingItem(null)} style={{ flex: 1, padding: 12, background: '#f3f4f6', borderRadius: 12, fontWeight: 700, color: '#6b7280', border: 'none', cursor: 'pointer' }}>{t.cancel}</button>
              <button onClick={() => saveShopItem(editingItem)} disabled={!editingItem.name.trim()} style={{ flex: 1, padding: 12, background: editingItem.name.trim() ? '#4f46e5' : '#c7d2fe', color: '#fff', borderRadius: 12, fontWeight: 800, border: 'none', cursor: editingItem.name.trim() ? 'pointer' : 'not-allowed' }}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderTop: '1px solid #e0e7ff', padding: 14, display: 'flex', justifyContent: 'space-around', zIndex: 40 }}>
        {[
          { id: 'bag', label: t.myBag, icon: <Home size={22} /> },
          { id: 'history', label: t.history, icon: <Clock size={22} /> },
          { id: 'shop', label: t.shop, icon: <ShoppingBag size={22} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setCurrentTab(tab.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', color: currentTab === tab.id ? '#4f46e5' : '#d1d5db' }}>
            <div style={{ padding: 10, borderRadius: 14, background: currentTab === tab.id ? '#e0e7ff' : '#f9fafb' }}>{tab.icon}</div>
            <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2 }}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
