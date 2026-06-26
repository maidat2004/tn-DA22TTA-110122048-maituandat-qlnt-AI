import Room from '../models/Room.js';
import Service from '../models/Service.js';

// ─── Hằng số ────────────────────────────────────────────────────────────────
const CONTACT_PHONE = '0795 473 012';
const ZALO_PHONE = '0795473012';
const ADDRESS = 'Nhà trọ Trang Thông, Trà Vinh';

// ─── Tiện ích xử lý văn bản ─────────────────────────────────────────────────

/** Chuẩn hoá: lowercase, bỏ dấu, đổi đ→d */
const normalizeText = (text = '') =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

/** Tách chuỗi thành mảng token (từ đơn) sau khi chuẩn hoá */
const tokenize = (text = '') =>
  normalizeText(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Đếm token nào trong message khớp với danh sách keywords */
const countMatches = (tokens, keywords) => {
  let score = 0;
  for (const kw of keywords) {
    const kwTokens = kw.split(/\s+/);
    if (kwTokens.length === 1) {
      if (tokens.includes(kw)) score++;
    } else {
      // multi-word keyword: check as subsequence in original normalised string
      const joined = tokens.join(' ');
      if (joined.includes(kw)) score += kwTokens.length;
    }
  }
  return score;
};

const escapeRegExp = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + ' đ';

// ─── Intent Definitions ──────────────────────────────────────────────────────
/**
 * Mỗi intent có:
 *  - id: tên định danh
 *  - keywords: mảng keyword (có thể multi-word, viết thường không dấu)
 *  - minScore: điểm tối thiểu để intent này được kích hoạt
 */
const INTENTS = [
  {
    id: 'greeting',
    keywords: ['xin chao', 'chao', 'hello', 'hi', 'alo', 'hey', 'chao ban', 'chao ad'],
    minScore: 1
  },
  {
    id: 'contact',
    keywords: ['lien he', 'so dien thoai', 'hotline', 'zalo', 'goi dien', 'so dt', 'lien lac', 'nhan tin'],
    minScore: 1
  },
  {
    id: 'address',
    keywords: ['dia chi', 'ban do', 'google map', 'o dau', 'duong di', 'vi tri', 'duong nao', 'khu vuc'],
    minScore: 1
  },
  {
    id: 'deposit',
    keywords: ['coc', 'dat coc', 'tien coc', 'coc phong', 'phi coc', 'so tien coc', 'muc coc'],
    minScore: 1
  },
  {
    id: 'payment',
    keywords: [
      'thanh toan', 'chuyen khoan', 'qr', 'hoa don', 'ngay 5', 'tinh tien', 'dong tien',
      'thu tien', 'tien phong', 'tien tro', 'tra tien', 'dong tien phong', 'phi hang thang',
      'ky han', 'khi nao dong', 'bao nhieu tien', 'chi phi hang thang'
    ],
    minScore: 1
  },
  {
    id: 'room_view',
    keywords: ['coi phong', 'xem phong', 'hen xem', 'dat lich xem', 'di xem', 'xem thu', 'tham quan'],
    minScore: 1
  },
  {
    id: 'loft',
    keywords: ['gac', 'gac lung', 'gac xep', 'tang lung', 'co gac'],
    minScore: 1
  },
  {
    id: 'curfew',
    keywords: ['gio giac', 'gio tu do', 'gio dong cua', 'gio ve', 'khong chung chu', 'khoa van tay', 'di ve khuya', 'gio ra vao', 'gio ve muon'],
    minScore: 1
  },
  {
    id: 'contract',
    keywords: [
      'hop dong', 'thu tuc', 'giay to', 'dang ky tam tru', 'cmnd', 'cccd', 'ky hop dong', 
      'thoi han hop dong', 'thoi han', 'thue phong nhu nao', 'thue phong nhu the nao', 
      'quy trinh thue', 'quy trinh thue phong', 'thu tuc thue', 'thu tuc thue phong', 
      'cac buoc thue', 'huong dan thue', 'muon thue thi lam sao', 'muon thue thi lam the nao', 
      'dang ky thue nhu nao', 'dang ky thue nhu the nao', 'dang ky thue phong', 'lam sao de thue'
    ],
    minScore: 1
  },
  {
    id: 'electricity_price',
    keywords: ['gia dien', 'tien dien', 'phi dien', 'so dien', 'dien bao nhieu', 'gia kwh', 'don gia dien'],
    minScore: 1
  },
  {
    id: 'water_price',
    keywords: ['gia nuoc', 'tien nuoc', 'phi nuoc', 'so nuoc', 'nuoc bao nhieu', 'don gia nuoc'],
    minScore: 1
  },
  {
    id: 'internet_price',
    keywords: ['gia mang', 'phi mang', 'tien mang', 'internet bao nhieu', 'phi wifi', 'tien wifi', 'cuoc mang'],
    minScore: 1
  },
  {
    id: 'parking_price',
    keywords: ['gui xe', 'phi xe', 'tien xe', 'giu xe', 'cho de xe', 'phi giu xe', 'bai xe', 'mat phi gui xe', 'gui xe mat phi', 'gui xe bao nhieu', 'xe may phi'],
    minScore: 1
  },
  {
    id: 'all_services',
    keywords: ['phi dich vu', 'dich vu', 'chi phi khac', 'cac chi phi', 'bao nhieu phi', 'phi hang thang la gi', 'tong phi'],
    minScore: 1
  },
  {
    id: 'pet',
    keywords: ['nuoi cho', 'nuoi meo', 'thu cung', 'vat nuoi', 'chim canh', 'cho meo', 'thu cung duoc khong', 'nuoi vat'],
    minScore: 1
  },
  {
    id: 'security',
    keywords: [
      'an ninh', 'an toan', 'trom cap', 'mat xe', 'camera', 'bao ve', 'khoa cong', 'khoa van tay',
      'co camera khong', 'co an toan khong', 'co bao ve khong', 'trom', 'cuop'
    ],
    minScore: 1
  },
  {
    id: 'guest',
    keywords: [
      'dan ban', 'ban be', 'ngu lai', 'nguoi than', 'cho ban o', 'nguoi la', 'cho o nho',
      'nguoi o them', 'khach o lai', 'mang nguoi', 'ban den choi'
    ],
    minScore: 1
  },
  {
    id: 'repair',
    keywords: [
      'sua chua', 'hu hong', 'hong hoc', 'bao sua', 'bong den', 'hu nuoc', 'hong dien',
      'thiet bi hong', 'vet nut', 'dieu hoa hong', 'quat hong', 'cua hong', 'yeu cau sua',
      'bi hong', 'bi hu', 'xin sua', 'hong roi', 'hu roi', 'hong mat'
    ],
    minScore: 1
  },
  {
    id: 'general_rules',
    keywords: ['noi quy', 'quy dinh chung', 'luat le', 'nguyen tac', 'co nhung quy dinh gi', 'nha tro quy dinh'],
    minScore: 1
  },
  {
    id: 'room_search',
    keywords: [
      'tim phong', 'tim tro', 'can thue', 'muon thue', 'thue phong', 'con phong trong',
      'co phong trong', 'phong nao trong', 'phong con trong', 'co phong khong',
      'phong re', 'phong gia re', 'phong trong', 'con phong nao'
    ],
    minScore: 1
  },
  {
    id: 'room_price_overview',
    keywords: [
      'khung gia', 'muc gia', 'bang gia', 'phan khuc', 'cac loai gia', 'gia phong',
      'gia thue', 'dien tich', 'loai phong', 'khung dien tich'
    ],
    minScore: 1
  },
  {
    id: 'room_cheapest',
    keywords: ['re nhat', 'gia thap nhat', 'tiet kiem nhat', 'phong re nhat', 'gia thap', 'co ban nhat'],
    minScore: 1
  },
  {
    id: 'room_largest',
    keywords: ['rong nhat', 'dien tich lon nhat', 'thoang nhat', 'phong lon nhat', 'rong rai nhat'],
    minScore: 1
  },
  {
    id: 'specific_room',
    keywords: [], // handled separately via extractRoomNumber
    minScore: 0
  },
  {
    id: 'room_status_count',
    keywords: [
      'bao nhieu phong trong', 'bao nhieu phong dang thue', 'bao nhieu phong da thue',
      'phong dang trong', 'phong dang thue', 'con bao nhieu phong', 'bao nhieu phong',
      'so phong trong', 'so phong dang thue', 'so phong da thue', 'so luong phong trong',
      'tinh trang phong', 'trong va thue', 'con phong khong'
    ],
    minScore: 1
  },
  {
    id: 'amenities_overview',
    keywords: [
      'tien ich', 'tien nghi', 'co nhung tien ich gi', 'co nhung tien nghi gi',
      'tien nghi phong', 'tien ich phong', 'trang thiet bi', 'thiet bi',
      'co san', 'co nhung gi', 'trong phong co gi', 'wifi', 'may lanh',
      've sinh', 'wc', 'bep', 'giu xe', 'quat', 'ban hoc'
    ],
    minScore: 1
  },
  {
    id: 'random_room',
    keywords: [
      'phong bat ky', 'phong bat ki', '1 phong bat ky', '1 phong bat ki', 'ngau nhien', 'phong ngau nhien',
      'xem 1 phong', 'xem phong bat ky', 'cho xem phong bat ky', 'thong tin phong bat ky'
    ],
    minScore: 1
  }
];

// ─── Intent Scoring ──────────────────────────────────────────────────────────

const PATTERN_INTENTS = [
  { id: 'pet', regex: /nuoi\s*(cho|meo|thu\s*cung|vat\s*nuoi|dong\s*vat|chim)/ },
  { id: 'curfew', regex: /gio\s*(giac|gioi\s*nghiem|tu\s*do|dong\s*cua|ra\s*vao|ve\s*muon)|di\s*ve\s*khuya|ve\s*muon|di\s*dem/ },
  { id: 'security', regex: /an\s*(ninh|toan)|trom\s*cap|mat\s*(xe|mat|do)|camera|bao\s*ve/ },
  { id: 'deposit', regex: /tien\s*coc|dat\s*coc|phi\s*coc|coc\s*phong|muc\s*coc/ },
  { id: 'payment', regex: /thanh\s*toan|chuyen\s*khoan|ngay\s*5|dong\s*tien|tra\s*tien|ck|qr|hoa\s*don|han\s*dong|han\s*thanh\s*toan/ },
  { id: 'contract', regex: /hop\s*dong|thu\s*tuc|giay\s*to|tam\s*tru|cmnd|cccd|dang\s*ky\s*thue|quy\s*trinh\s*thue|thue\s*phong\s*(nhu\s*the\s*nao|nhu\s*nao)|muon\s*thue|lam\s*sao\s*de\s*thue/ },
  { id: 'guest', regex: /dan\s*ban|ban\s*be|ngu\s*lai|nguoi\s*than|nguoi\s*la|khach\s*o\s*lai|nguoi\s*o\s*them/ },
  { id: 'repair', regex: /sua\s*chua|hu\s*hong|hong\s*hoc|bao\s*sua|yeu\s*cau\s*sua|bi\s*hong|bi\s*hu/ },
  { id: 'room_view', regex: /xem\s*phong|coi\s*phong|hen\s*xem|lich\s*xem|di\s*xem/ },
  { id: 'loft', regex: /gac\s*(lung|xep)|tang\s*lung|co\s*gac/ },
  { id: 'contact', regex: /lien\s*he|so\s*dien\s*thoai|hotline|zalo|goi\s*dien|so\s*dt|lien\s*lac|nhan\s*tin/ },
  { id: 'address', regex: /dia\s*chi|ban\s*do|google\s*map|o\s*dau|duong\s*di|vi\s*tri/ },
  { id: 'electricity_price', regex: /gia\s*dien|tien\s*dien|phi\s*dien|so\s*dien|kwh/ },
  { id: 'water_price', regex: /gia\s*nuoc|tien\s*nuoc|phi\s*nuoc|so\s*nuoc|khoi\s*nuoc/ },
  { id: 'internet_price', regex: /gia\s*mang|phi\s*mang|tien\s*mang|wifi|internet|cuoc\s*mang/ },
  { id: 'parking_price', regex: /gui\s*xe|phi\s*xe|tien\s*xe|giu\s*xe|cho\s*de\s*xe|bai\s*xe/ },
  { id: 'all_services', regex: /phi\s*dich\s*vu|dich\s*vu|chi\s*phi\s*khac|cac\s*chi\s*phi|tong\s*phi/ },
  { id: 'general_rules', regex: /noi\s*quy|quy\s*dinh\s*chung|luat\s*le|nguyen\s*tac/ },
  { id: 'room_status_count', regex: /bao\s*nhieu\s*phong\s*trong|con\s*bao\s*nhieu\s*phong|so\s*phong\s*trong|tinh\s*trang\s*phong/ },
  { id: 'amenities_overview', regex: /tien\s*(ich|nghi)|trang\s*thiet\s*bi|thiet\s*bi|co\s*san|trong\s*phong\s*co\s*gi/ }
];

/**
 * Phân tích câu hỏi, trả về danh sách {id, score} sắp xếp theo điểm giảm dần.
 * Phân tích từng token để tránh false positive khi có nhiều từ khóa chồng nhau.
 */
const scoreIntents = (message) => {
  const tokens = tokenize(message);
  const joined = tokens.join(' ');

  return INTENTS.map((intent) => {
    let score = countMatches(tokens, intent.keywords) +
      // bonus for multi-word matches found in joined string
      intent.keywords.filter(kw => kw.includes(' ') && joined.includes(kw)).length;
    
    // Add big bonus (+10) if the normalized message matches the intent's regex pattern
    const pattern = PATTERN_INTENTS.find(p => p.id === intent.id);
    if (pattern && pattern.regex.test(joined)) {
      score += 10;
    }
    
    return { id: intent.id, score };
  })
    .filter(i => i.score >= (INTENTS.find(x => x.id === i.id)?.minScore ?? 1))
    .sort((a, b) => b.score - a.score);
};

/** Trả về intent có điểm cao nhất (null nếu không khớp gì) */
const topIntent = (message) => {
  const ranked = scoreIntents(message);
  return ranked.length ? ranked[0].id : null;
};

// ─── Kiểm tra phạm vi nhà trọ ────────────────────────────────────────────────

/** Danh sách keyword khẳng định câu hỏi liên quan đến nhà trọ */
const BOARDING_HOUSE_KEYWORDS = [
  'phong', 'tro', 'thue', 'con trong', 'gia', 'tam gia', 'khoang', 'trieu',
  'dien tich', 'm2', 'nguoi', 'sinh vien', 'wifi', 'wc', 'bep', 'xe',
  'ban hoc', 'may lanh', 'nguyen can', 'rieng', 'lien he', 'so dien thoai',
  'hotline', 'zalo', 'dia chi', 'ban do', 'google map', 'duong di',
  'coc', 'dat coc', 'thanh toan', 'chuyen khoan', 'qr', 'hoa don', 'ngay 5',
  'noi quy', 'quy dinh', 'gio giac', 've sinh', 'an ninh', 'an toan',
  'gia dien', 'tien dien', 'gia nuoc', 'tien nuoc', 'sua chua', 'hu hong',
  'yeu cau', 'bao tri', 'hop dong', 'nguoi thue', 'chu tro',
  'vat nuoi', 'nuoi cho', 'nuoi meo', 'thu cung', 'dan ban', 'ban be',
  'ngu lai', 'nguoi than', 'gac lung', 'gac xep', 'khoa van tay', 'camera',
  'bao ve', 'trom cap', 'coi phong', 'xem phong', 'hen xem', 'tam tru',
  'dong tien', 'tien phong', 'gui xe', 'phi xe', 'phi mang', 'tien mang',
  'tien xe', 'phi dich vu', 'chim canh', 'tron',
  'tien ich', 'tien nghi', 'tien nghi phong', 'tien ich phong', 'bat ky',
  'bat ki', 'ngau nhien', 'may giat', 'tu lanh', 'giat la', 'giat do',
  'giuong', 'nem', 'tu quan ao', 'trang thiet bi', 'noi that'
];

const isInScope = (tokens) => {
  const joined = tokens.join(' ');
  return BOARDING_HOUSE_KEYWORDS.some(kw => {
    if (kw.includes(' ')) return joined.includes(kw);
    return tokens.includes(kw);
  });
};

// ─── Phân tích giá / diện tích / số người ────────────────────────────────────

const parseCompactMillion = (major, minor = '') => {
  const m = Number(major);
  if (!Number.isFinite(m)) return null;
  if (!minor) return m * 1_000_000;
  const mn = Number(minor);
  if (!Number.isFinite(mn)) return m * 1_000_000;
  if (minor.length === 1) return m * 1_000_000 + mn * 100_000;
  if (minor.length === 2) return m * 1_000_000 + mn * 10_000;
  return m * 1_000_000 + mn * 1_000;
};

const parseMoneyToVnd = (rawValue, rawUnit = '') => {
  const value = Number(String(rawValue || '').replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const unit = normalizeText(rawUnit);
  if (unit.includes('tr') || unit === 'm' || value < 100) return Math.round(value * 1_000_000);
  return Math.round(value);
};

const rangesOverlap = (aS, aE, bS, bE) => aS < bE && bS < aE;

const extractPriceRange = (message) => {
  const normalized = normalizeText(message);
  const compactMatches = [...normalized.matchAll(/(\d+)\s*(trieu|tr|m(?!\s*(?:2|²|et)))\s*(\d{1,3})?/g)]
    .map(m => ({ value: parseCompactMillion(m[1], m[3]), index: m.index, end: m.index + m[0].length }))
    .filter(x => x.value && x.value >= 100_000);

  const regularMatches = [...normalized.matchAll(/(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|vnd|dong|d)?/g)]
    .filter(m => {
      const s = m.index; const e = m.index + m[0].length;
      if (compactMatches.some(x => rangesOverlap(s, e, x.index, x.end))) return false;
      if (s > 0 && /\p{L}/u.test(normalized[s - 1])) return false;
      const after = normalized.slice(e).trim();
      if ((m[2] || '') === 'm' && /^(2|²|et)/.test(after)) return false;
      if (!m[2] && /^(nguoi|ban|sinh vien|m2|met|tuoi)/.test(after)) return false;
      return true;
    })
    .map(m => ({ value: parseMoneyToVnd(m[1], m[2]), index: m.index }))
    .filter(x => x.value && x.value >= 100_000);

  const matches = [...compactMatches, ...regularMatches].sort((a, b) => a.index - b.index);
  if (!matches.length) return {};
  const values = matches.map(x => x.value);

  if (values.length >= 2 && /(tu|den|toi|khoang)/.test(normalized)) {
    return { minPrice: Math.min(values[0], values[1]), maxPrice: Math.max(values[0], values[1]) };
  }
  const price = values[0];
  if (/(duoi|nho hon|toi da|khong qua|tro xuong)/.test(normalized)) return { maxPrice: price, targetPrice: price };
  if (/(tren|lon hon|tu)/.test(normalized)) return { minPrice: price, targetPrice: price };
  return { targetPrice: price, minPrice: Math.round(price * 0.85), maxPrice: Math.round(price * 1.15) };
};

const hasExplicitPrice = (pr) => Boolean(pr.minPrice || pr.maxPrice);

const extractAreaRange = (message) => {
  const normalized = normalizeText(message);
  const matches = [...normalized.matchAll(/(\d+(?:[.,]\d+)?)\s*(m2|m²|met|met vuong)/g)]
    .map(m => Number(m[1].replace(',', '.'))).filter(v => Number.isFinite(v));
  if (!matches.length) return {};
  if (matches.length >= 2) return { minArea: Math.min(matches[0], matches[1]), maxArea: Math.max(matches[0], matches[1]) };
  const area = matches[0];
  if (/(duoi|nho hon|toi da)/.test(normalized)) return { maxArea: area };
  if (/(tren|lon hon|tu)/.test(normalized)) return { minArea: area };
  return { minArea: Math.round(area * 0.8), maxArea: Math.round(area * 1.2) };
};

const extractCapacity = (message) => {
  const normalized = normalizeText(message);
  const m = normalized.match(/(\d+)\s*(nguoi|ban|sinh vien)/);
  if (!m) return null;
  const c = Number(m[1]);
  return Number.isFinite(c) ? c : null;
};

const extractFloor = (message) => {
  const normalized = normalizeText(message);
  if (/(tang tret|tret|lau 1|tang 1)/.test(normalized)) return 1;
  const m = normalized.match(/tang\s*(\d+)/);
  if (!m) return null;
  const f = Number(m[1]);
  return Number.isFinite(f) ? f : null;
};

const AMENITY_PATTERNS = [
  { key: 'wifi',         label: 'WiFi',         patterns: ['wifi', 'internet', 'mang'] },
  { key: 'wc_private',   label: 'WC riêng',     patterns: ['wc rieng', 've sinh rieng', 'toilet rieng', 'nha tam rieng'] },
  { key: 'kitchen',      label: 'bếp',           patterns: ['bep', 'nau an', 'khu bep'] },
  { key: 'parking',      label: 'chỗ để xe',    patterns: ['cho de xe', 'giu xe', 'de xe', 'xe may'] },
  { key: 'fan',          label: 'quạt',          patterns: ['quat', 'quat tran'] },
  { key: 'desk',         label: 'bàn học',       patterns: ['ban hoc', 'ban lam viec'] },
  { key: 'private_room', label: 'phòng riêng',  patterns: ['phong rieng', 'rieng tu', 'o rieng'] },
  { key: 'whole_house',  label: 'nguyên căn',   patterns: ['nguyen can', 'ca can'] },
  { key: 'air_conditioner', label: 'máy lạnh',  patterns: ['may lanh', 'dieu hoa'] }
];

const extractAmenities = (message) => {
  const normalized = normalizeText(message);
  return AMENITY_PATTERNS.filter(item => item.patterns.some(p => normalized.includes(p)));
};

// ─── Price Tiers ─────────────────────────────────────────────────────────────

const getDynamicTiers = async () => {
  try {
    const rooms = await Room.find({}).lean();
    if (!rooms?.length) {
      return [
        { key: 'basic', label: 'phòng cơ bản giá rẻ', min: 0, max: 1_300_000, target: 1_200_000, note: 'diện tích 14m², sức chứa 2 người' },
        { key: 'economy', label: 'phòng tiết kiệm', min: 1_400_000, max: 1_600_000, target: 1_500_000, note: 'diện tích 16m², sức chứa 2 người' },
        { key: 'standard_saving', label: 'phòng tiêu chuẩn tiết kiệm', min: 1_700_000, max: 1_900_000, target: 1_800_000, note: 'diện tích 18m² - 20m², sức chứa 3 người' },
        { key: 'standard_large', label: 'phòng tiêu chuẩn rộng', min: 1_900_000, max: 2_100_000, target: 2_000_000, note: 'diện tích 22m² - 24m², sức chứa 4 người' },
        { key: 'private_large', label: 'phòng riêng rộng', min: 2_400_000, max: 2_600_000, target: 2_500_000, note: 'diện tích 26m² - 28m², sức chứa 4 người' }
      ];
    }
    const priceGroups = {};
    rooms.forEach(room => {
      const price = room.price;
      if (!priceGroups[price]) priceGroups[price] = { price, areas: new Set(), capacities: new Set(), totalCount: 0, availableCount: 0 };
      priceGroups[price].areas.add(room.area);
      if (room.capacity) priceGroups[price].capacities.add(room.capacity);
      priceGroups[price].totalCount++;
      if (room.status === 'available') priceGroups[price].availableCount++;
    });

    const sortedPrices = Object.keys(priceGroups).map(Number).sort((a, b) => a - b);
    const labelList = ['phòng cơ bản giá rẻ', 'phòng tiết kiệm', 'phòng tiêu chuẩn tiết kiệm', 'phòng tiêu chuẩn rộng', 'phòng riêng rộng'];

    return sortedPrices.map((price, idx) => {
      const g = priceGroups[price];
      const areas = Array.from(g.areas).sort((a, b) => a - b);
      const caps = Array.from(g.capacities).sort((a, b) => a - b);
      let label = '';
      if (sortedPrices.length === 5) { label = labelList[idx]; }
      else {
        const ratio = idx / (sortedPrices.length - 1 || 1);
        if (ratio <= 0.2) label = labelList[0];
        else if (ratio <= 0.4) label = labelList[1];
        else if (ratio <= 0.6) label = labelList[2];
        else if (ratio <= 0.8) label = labelList[3];
        else label = labelList[4];
      }
      return {
        key: `tier_${idx}`, label,
        min: price * 0.95, max: price * 1.05, target: price,
        note: `diện tích ${areas.map(a => `${a}m²`).join(' - ')}, sức chứa ${caps.map(c => `${c} người`).join(' hoặc ')}`,
        areas, capacities: caps, totalCount: g.totalCount, availableCount: g.availableCount
      };
    });
  } catch (e) { console.error('getDynamicTiers error:', e); return []; }
};

const getPriceTier = (price = 0, tiers = []) =>
  tiers.find(t => price >= t.min && price <= t.max) || null;

const detectPriceTier = (message, priceRange = {}, tiers = []) => {
  if (hasExplicitPrice(priceRange)) {
    const tp = priceRange.targetPrice || priceRange.maxPrice || priceRange.minPrice;
    return getPriceTier(tp, tiers);
  }
  const normalized = normalizeText(message);
  for (const tier of tiers) {
    const lp = normalizeText(tier.label).replace(/\s+/g, '\\s*');
    const pp = `${tier.target / 1_000_000}tr|${tier.target / 1_000_000}\\s*trieu`;
    if (new RegExp(`(${lp}|${pp})`, 'i').test(normalized)) return tier;
  }
  if (/(phong rieng|rieng tu|cao cap|rong rai|bep rieng|nguyen can)/.test(normalized))
    return tiers.find(t => t.label.includes('riêng') || t.label.includes('rộng')) || null;
  return null;
};

const buildPriceFilters = (message, priceRange = {}, tiers = []) => {
  const priceTier = detectPriceTier(message, priceRange, tiers);
  if (hasExplicitPrice(priceRange)) return { ...priceRange, priceTier };
  if (priceTier) return { minPrice: priceTier.min, maxPrice: priceTier.max, priceTier };
  return { ...priceRange, priceTier: null };
};

// ─── Room Query / Scoring ─────────────────────────────────────────────────────

const buildRoomQuery = ({ minPrice, maxPrice, minArea, maxArea, capacity, floor }) => {
  const q = { status: 'available' };
  if (minPrice || maxPrice) { q.price = {}; if (minPrice) q.price.$gte = minPrice; if (maxPrice) q.price.$lte = maxPrice; }
  if (minArea || maxArea) { q.area = {}; if (minArea) q.area.$gte = minArea; if (maxArea) q.area.$lte = maxArea; }
  if (capacity) q.capacity = { $gte: capacity };
  if (floor) q.floor = floor;
  return q;
};

const normalizedRoomText = (room) =>
  normalizeText([room.roomNumber, room.description, room.address, ...(room.amenities || [])].filter(Boolean).join(' '));

const roomMatchesAmenity = (room, amenity) =>
  amenity.patterns.some(p => normalizedRoomText(room).includes(p));

const getRoomAreaText = (room) => {
  if (!room?.area) return 'chưa rõ diện tích';
  const fmtDim = v => { const n = Number(v || 0); return Number.isFinite(n) && n > 0 ? (Number.isInteger(n) ? String(n) : String(n).replace('.', ',')) : null; };
  const l = fmtDim(room.length); const w = fmtDim(room.width);
  return l && w ? `${room.area}m² (${l}m × ${w}m)` : `${room.area}m²`;
};

const scoreRoom = (room, filters) => {
  let score = 0;
  const matchedAmenities = []; const missingAmenities = [];
  if (filters.capacity) {
    if (room.capacity === filters.capacity) score += 18;
    else if (room.capacity > filters.capacity) score += Math.max(12 - (room.capacity - filters.capacity) * 2, 4);
  }
  if (filters.maxPrice) { const gap = filters.maxPrice - room.price; if (gap >= 0) score += 18 + Math.min(Math.round(gap / 100_000), 8); }
  if (filters.minPrice && room.price >= filters.minPrice) score += 6;
  if (filters.priceTier) { const inT = room.price >= filters.priceTier.min && room.price <= filters.priceTier.max; if (inT) score += room.price === filters.priceTier.target ? 16 : 10; }
  if (filters.minArea && room.area >= filters.minArea) score += 8;
  if (filters.maxArea && room.area <= filters.maxArea) score += 8;
  if (filters.floor && room.floor === filters.floor) score += 8;
  (filters.amenities || []).forEach(a => { if (roomMatchesAmenity(room, a)) { score += 12; matchedAmenities.push(a.label); } else missingAmenities.push(a.label); });
  score += Math.max(0, 10 - Math.round((room.price || 0) / 300_000));
  if ((room.area || 0) >= 25) score += 3;
  return { score, matchedAmenities, missingAmenities };
};

const rankRooms = (rooms, filters) =>
  rooms.map(room => ({ room, match: scoreRoom(room, filters) }))
    .sort((a, b) => b.match.score !== a.match.score ? b.match.score - a.match.score : (a.room.price || 0) - (b.room.price || 0));

const isPerfectMatch = (room, filters) => {
  if (filters.maxPrice && room.price > filters.maxPrice) return false;
  if (filters.minPrice && room.price < filters.minPrice) return false;
  if (filters.capacity && room.capacity < filters.capacity) return false;
  if (filters.floor && room.floor !== filters.floor) return false;
  if (filters.minArea && room.area < filters.minArea) return false;
  if (filters.maxArea && room.area > filters.maxArea) return false;
  if (filters.amenities?.length) for (const a of filters.amenities) if (!roomMatchesAmenity(room, a)) return false;
  return true;
};

const describeCriteria = ({ minPrice, maxPrice, minArea, maxArea, capacity, floor, amenities, priceTier }) => {
  const parts = [];
  if (priceTier) parts.push(`khung ${formatCurrency(priceTier.target)}/tháng (${priceTier.label})`);
  if (capacity) parts.push(`ở ${capacity} người`);
  if (!priceTier && maxPrice) parts.push(`giá tối đa ${formatCurrency(maxPrice)}/tháng`);
  if (!priceTier && minPrice) parts.push(`giá từ ${formatCurrency(minPrice)}/tháng`);
  if (minArea && maxArea) parts.push(`diện tích khoảng ${minArea}-${maxArea}m²`);
  else if (minArea) parts.push(`diện tích từ ${minArea}m²`);
  else if (maxArea) parts.push(`diện tích tối đa ${maxArea}m²`);
  if (floor) parts.push(`tầng ${floor}`);
  if (amenities?.length) parts.push(`tiện nghi: ${amenities.map(a => a.label).join(', ')}`);
  return parts.length ? parts.join(', ') : 'phòng đang trống';
};

const roomFitReason = (room, filters, match, tiers) => {
  const reasons = [];
  const t = getPriceTier(room.price, tiers);
  if (t) reasons.push(`thuộc nhóm ${t.label} ${formatCurrency(t.target)}/tháng`);
  if (filters.capacity) {
    if (room.capacity === filters.capacity) reasons.push(`vừa đúng ${filters.capacity} người`);
    else if (room.capacity > filters.capacity) reasons.push(`sức chứa ${room.capacity} người, rộng hơn nhu cầu`);
  }
  if (filters.maxPrice && room.price <= filters.maxPrice) reasons.push('nằm trong mức giá bạn hỏi');
  if (room.area) { if (room.area >= 30) reasons.push('diện tích rộng'); else if (room.area <= 22) reasons.push('gọn, hợp người cần tiết kiệm'); }
  if (match?.matchedAmenities?.length) reasons.push(`khớp tiện nghi: ${match.matchedAmenities.join(', ')}`);
  else if (room.amenities?.length) reasons.push(`có ${room.amenities.slice(0, 3).join(', ')}`);
  if (match?.missingAmenities?.length) reasons.push(`chưa rõ: ${match.missingAmenities.slice(0, 2).join(', ')}`);
  return reasons.length ? reasons.join('; ') : 'phù hợp để xem trước';
};

const buildDirectRoomAnswer = (rankedRooms, filters) => {
  const rooms = rankedRooms.map(x => x.room);
  const parts = [];
  if (filters.targetPrice) {
    const exact = rooms.filter(r => Number(r.price) === Number(filters.targetPrice));
    const nearest = rooms.length ? rooms.reduce((n, r) => Math.abs(r.price - filters.targetPrice) < Math.abs(n - filters.targetPrice) ? r.price : n, rooms[0].price) : null;
    if (exact.length) parts.push(`Có phòng đúng tầm ${formatCurrency(filters.targetPrice)}/tháng.`);
    else if (nearest) parts.push(`Tầm ${formatCurrency(filters.targetPrice)}/tháng hiện chưa có đúng giá; mức gần nhất là ${formatCurrency(nearest)}/tháng.`);
  } else if (filters.maxPrice) parts.push(`Có phòng trong mức tối đa ${formatCurrency(filters.maxPrice)}/tháng.`);
  else if (filters.minPrice) parts.push(`Có phòng từ mức ${formatCurrency(filters.minPrice)}/tháng trở lên.`);
  if (filters.capacity) {
    const ec = rooms.filter(r => Number(r.capacity) === Number(filters.capacity)).length;
    const lc = rooms.filter(r => Number(r.capacity) > Number(filters.capacity)).length;
    if (ec) parts.push(`Với ${filters.capacity} người, mình ưu tiên phòng vừa sức chứa để chi phí gọn hơn.`);
    else if (lc) parts.push(`Với ${filters.capacity} người, hiện có phòng rộng hơn nhu cầu.`);
  }
  if (filters.amenities?.length) parts.push(`Tiện nghi bạn cần (${filters.amenities.map(a => a.label).join(', ')}) được ưu tiên trong kết quả.`);
  if (!parts.length) parts.push('Mình đã lọc các phòng trống phù hợp nhất với nhu cầu bạn vừa hỏi.');
  return parts.join(' ');
};

const buildRoomAdvice = (rankedRooms, filters, tiers, isFallback) => {
  const perfect = rankedRooms.filter(({ room }) => isPerfectMatch(room, filters));

  if (!isFallback && perfect.length > 0) {
    const direct = buildDirectRoomAnswer(rankedRooms, filters);
    const top = perfect.slice(0, 3);
    const lines = top.map(({ room }, i) => {
      const t = getPriceTier(room.price, tiers);
      return `${i + 1}. Phòng **${room.roomNumber}**\n   - Giá: ${formatCurrency(room.price)}/tháng${t ? ` (${t.label})` : ''}\n   - Diện tích: ${getRoomAreaText(room)}\n   - Sức chứa: tối đa ${room.capacity || 'N/A'} người\n   - Tầng: ${room.floor || 'N/A'}\n   - Tiện nghi: ${room.amenities?.join(', ') || 'Đầy đủ cơ bản'}`;
    });
    const extra = perfect.length > 3 ? `\n\n*(Còn ${perfect.length - 3} phòng khác cũng khớp, bạn xem đầy đủ tại trang Phòng trọ)*` : '';
    return `${direct}\n\nMình tìm thấy **${perfect.length}** phòng trống khớp với yêu cầu của bạn:\n\n${lines.join('\n\n')}${extra}\n\nBạn có thể nhấn **"Thuê phòng"** trong danh sách hoặc liên hệ ${CONTACT_PHONE} để đăng ký thuê nhé!`;
  }

  const best = rankedRooms.slice(0, 3);
  const criteria = describeCriteria(filters);

  if (isFallback) {
    const lines = best.map(({ room }, i) => {
      const t = getPriceTier(room.price, tiers);
      return `${i + 1}. Phòng **${room.roomNumber}**\n   - Giá: ${formatCurrency(room.price)}/tháng${t ? ` (${t.label})` : ''}\n   - Diện tích: ${getRoomAreaText(room)}\n   - Sức chứa: tối đa ${room.capacity || 'N/A'} người\n   - Tầng: ${room.floor || 'N/A'}\n   - Tiện nghi: ${room.amenities?.join(', ') || 'Đầy đủ cơ bản'}`;
    });
    return `${buildDirectRoomAnswer(rankedRooms, filters)}\n\nHiện không có phòng khớp hoàn toàn với tiêu chí bạn tìm (${criteria}).\n\nCác phòng trống hiện có:\n\n${lines.join('\n\n')}\n\nLiên hệ ${CONTACT_PHONE} để tư vấn thêm về các phòng sắp trống nhé!`;
  }

  const lines = best.map(({ room, match }, i) => {
    const t = getPriceTier(room.price, tiers);
    return `${i + 1}. Phòng ${room.roomNumber}\n   - Giá: ${formatCurrency(room.price)}/tháng${t ? ` (${t.label})` : ''}\n   - Diện tích: ${getRoomAreaText(room)}\n   - Sức chứa: tối đa ${room.capacity || 'N/A'} người\n   - Tầng: ${room.floor || 'N/A'}\n   - Lý do phù hợp: ${roomFitReason(room, filters, match, tiers)}`;
  });
  const cheapest = best.reduce((b, x) => x.room.price < b.room.price ? x : b, best[0]).room;
  const largest = best.reduce((b, x) => (x.room.area || 0) > (b.room.area || 0) ? x : b, best[0]).room;
  const bestMatch = best[0].room;
  const rec = cheapest._id?.toString() === largest._id?.toString()
    ? `\n\nGợi ý: phòng ${bestMatch.roomNumber} khớp tổng thể nhất.`
    : `\n\nGợi ý nhanh:\n- Ưu tiên tiết kiệm: phòng ${cheapest.roomNumber}\n- Ưu tiên rộng rãi: phòng ${largest.roomNumber}\n- Khớp tổng thể nhất: phòng ${bestMatch.roomNumber}`;

  return `${buildDirectRoomAnswer(rankedRooms, filters)}\n\nLọc theo: ${criteria}.\n\nCó ${rankedRooms.length} phòng gần phù hợp. Gợi ý ${best.length} phòng:\n\n${lines.join('\n\n')}${rec}\n\nBạn có thể hỏi thêm: "phòng nào rẻ nhất", "phòng nào rộng nhất", "có WC riêng không".`;
};

// ─── Phòng cụ thể ─────────────────────────────────────────────────────────────

const extractRoomNumber = (message, allRoomNumbers) => {
  const normalized = normalizeText(message);
  const m = normalized.match(/(?:phong|room|p\.?)(?:\s+so)?\s*([a-z0-9-]*\d+[a-z0-9-*]*)/);
  if (m) { const found = allRoomNumbers.find(r => normalizeText(r) === m[1].trim()); if (found) return found; }
  const tokens = normalized.split(/[\s,?!.]+/);
  for (const token of tokens) { const found = allRoomNumbers.find(r => normalizeText(r) === token); if (found) return found; }
  return null;
};

const detectInvalidRoomNumber = (message, allRoomNumbers) => {
  const normalized = normalizeText(message);
  const m = normalized.match(/(?:phong|room|p\.?)(?:\s+so)?\s*([a-z0-9-]*\d+[a-z0-9-*]*)/);
  if (m) {
    const rawNum = m[1].trim();
    const found = allRoomNumbers.find(r => normalizeText(r) === rawNum);
    if (!found) {
      return rawNum.toUpperCase();
    }
  }
  return null;
};

const specificRoomReply = (matchedRoomNumber, allRooms, tiers) => {
  const room = allRooms.find(r => r.roomNumber === matchedRoomNumber);
  if (!room) return null;
  const statusLabel = room.status === 'available' ? 'Đang **Trống**' : room.status === 'occupied' ? '**Đã thuê**' : '**Đang bảo trì**';
  const t = getPriceTier(room.price, tiers);
  let reply = `Phòng **${room.roomNumber}**:\n`;
  reply += `- **Trạng thái**: ${statusLabel}\n`;
  reply += `- **Giá thuê**: ${formatCurrency(room.price)}/tháng${t ? ` (${t.label})` : ''}\n`;
  reply += `- **Diện tích**: ${getRoomAreaText(room)}\n`;
  reply += `- **Sức chứa**: tối đa ${room.capacity || 'N/A'} người\n`;
  reply += `- **Tầng**: ${room.floor || 'N/A'}\n`;
  reply += `- **Tiện nghi**: ${room.amenities?.length ? room.amenities.join(', ') : 'Chưa cập nhật'}\n`;
  if (room.description) reply += `- **Mô tả**: ${room.description}\n`;
  if (room.status === 'available') reply += `\nPhòng đang trống, bạn nhấn **"Thuê phòng"** trong danh sách hoặc liên hệ ${CONTACT_PHONE} để giữ chỗ nhé!`;
  else if (room.status === 'occupied') reply += `\nPhòng này đã có người thuê. Bạn muốn mình lọc các phòng trống có mức giá/tiện nghi tương đương không?`;
  else reply += `\nPhòng đang bảo trì, sẽ sớm sẵn sàng. Bạn có thể liên hệ ${CONTACT_PHONE} để được thông báo khi phòng mở lại.`;
  return reply;
};

// ─── FAQ dịch vụ từ DB ────────────────────────────────────────────────────────

const faqServicesReply = async (intentId) => {
  try {
    const services = await Service.find({ isActive: true }).lean();
    if (!services?.length) return null;

    const typeMap = { electricity_price: 'electricity', water_price: 'water', internet_price: 'internet', parking_price: 'parking' };
    const labelMap = { electricity_price: 'tiền điện', water_price: 'tiền nước', internet_price: 'mạng/Internet', parking_price: 'giữ xe' };
    const descMap = { electricity_price: 'Tính theo số điện thực tế sử dụng.', water_price: 'Tính theo m³ thực tế sử dụng.', internet_price: 'Đường truyền internet tốc độ cao.', parking_price: 'Khu vực để xe an toàn.' };

    if (typeMap[intentId]) {
      const s = services.find(x => x.type === typeMap[intentId]);
      if (s) return `Đơn giá **${labelMap[intentId]}** tại nhà trọ:\n- **${s.name}**: **${formatCurrency(s.unitPrice)} / ${s.unit}**\n*(${s.description || descMap[intentId]})*`;
      // Fallback khi không có trong DB
      const fallbacks = {
        parking_price: `Chi phí giữ xe tại nhà trọ chưa được cập nhật trên hệ thống. Bạn liên hệ **${CONTACT_PHONE}** để hỏi trực tiếp nhé.`,
        electricity_price: `Đơn giá tiền điện chưa được cập nhật. Bạn liên hệ **${CONTACT_PHONE}** để biết thêm chi tiết.`,
        water_price: `Đơn giá tiền nước chưa được cập nhật. Bạn liên hệ **${CONTACT_PHONE}** để biết thêm chi tiết.`,
        internet_price: `Chi phí mạng Internet chưa được cập nhật. Bạn liên hệ **${CONTACT_PHONE}** để biết thêm chi tiết.`
      };
      if (fallbacks[intentId]) return fallbacks[intentId];
    }

    if (intentId === 'all_services') {
      const lines = services.map(s => `- **${s.name}**: **${formatCurrency(s.unitPrice)} / ${s.unit}** — ${s.description || 'Không có ghi chú'}`).join('\n');
      return `Bảng phí dịch vụ hiện áp dụng tại nhà trọ:\n\n${lines}\n\nMọi chi phí được chốt và tính hóa đơn minh bạch, gửi đến bạn vào ngày 5 hằng tháng.`;
    }
  } catch (e) { console.error('faqServicesReply error:', e); }
  return null;
};

// ─── Trả lời theo intent ──────────────────────────────────────────────────────

const replyByIntent = async (intent, tiers, allRooms) => {
  switch (intent) {
    case 'greeting':
      return `Chào bạn! Mình là trợ lý nhà trọ Trang Thông.\n\nMình có thể giúp bạn:\n- 🏠 Tìm phòng theo giá, diện tích, số người\n- 💡 Giải đáp phí điện, nước, WiFi, xe\n- 📋 Hỏi về nội quy, hợp đồng, đặt cọc\n- 📞 Kết nối liên hệ chủ trọ\n\nBạn muốn hỏi gì?`;

    case 'contact':
      return `Bạn có thể liên hệ chủ trọ qua:\n- **Điện thoại**: ${CONTACT_PHONE}\n- **Zalo**: https://zalo.me/${ZALO_PHONE}\n\nAnh Tuấn Đạt sẽ hỗ trợ bạn tư vấn và đặt lịch xem phòng trực tiếp.`;

    case 'address':
      return `Nhà trọ tọa lạc tại: **${ADDRESS}**.\n\nBạn mở trang **Liên hệ** trên website để xem bản đồ Google Maps và đường đi chi tiết nhé.`;

    case 'deposit':
      return `Khi vào ở, bạn cần đóng:\n- **Tiền cọc**: 1 tháng tiền phòng\n- **Tháng đầu tiên**: 1 tháng tiền phòng (đóng trước)\n- Điện, nước, dịch vụ tính theo hóa đơn hằng tháng\n\nTiền cọc sẽ được hoàn lại khi bạn trả phòng đúng hợp đồng và không có phát sinh thiệt hại.`;

    case 'payment':
      return `Quy định thanh toán:\n- Tiền phòng đóng **định kỳ ngày 5** hằng tháng\n- Khi có hóa đơn, bạn quét **mã QR** chuyển khoản hoặc thanh toán trong trang Hóa đơn\n- Sau khi chuyển khoản, bấm **"Đã chuyển khoản"** và chờ chủ trọ xác nhận`;

    case 'room_view':
      return `Để xem phòng trực tiếp, bạn vui lòng liên hệ hotline/Zalo **${CONTACT_PHONE}** để đặt lịch hẹn.\nAnh quản lý sẽ dẫn bạn tham quan và tư vấn các phòng đang trống phù hợp nhất.`;

    case 'loft':
      return `Tất cả phòng trong nhà trọ đều có **gác lửng** đúc bê tông kiên cố, rộng rãi:\n- **Tầng dưới**: bếp, bàn học, sinh hoạt chung\n- **Gác lửng**: phòng ngủ riêng tư, ấm cúng\n\nGác lửng giúp bạn tối ưu không gian dù ở một mình hay ở ghép.`;

    case 'curfew':
      return `Nhà trọ **không quy định giờ giới nghiêm**, giờ giấc đi lại hoàn toàn tự do.\n- Lối đi **riêng biệt**, không chung chủ\n- Cổng ra vào khóa **vân tay** – an toàn, thuận tiện đi về khuya\n\nBạn thoải mái đi học, làm thêm hay về muộn mà không lo ảnh hưởng ai.`;

    case 'contract':
      return `Quy trình và thủ tục thuê phòng tại nhà trọ Trang Thông:\n\n` +
        `1. **Chọn phòng & Đặt lịch xem**: Bạn có thể xem danh sách phòng trống trực tiếp trên website này, sau đó liên hệ hotline/Zalo **${CONTACT_PHONE}** để hẹn lịch xem phòng thực tế.\n` +
        `2. **Đặt cọc giữ phòng**: Tiền đặt cọc thông thường là **1 tháng tiền phòng** để giữ chỗ chắc chắn.\n` +
        `3. **Ký hợp đồng thuê**: Thời hạn hợp đồng thuê phòng tối thiểu từ **6 tháng đến 1 năm**. Khi ký hợp đồng, bạn vui lòng chuẩn bị **CMND/CCCD** bản gốc của tất cả các thành viên ở cùng.\n` +
        `4. **Nhận phòng & Đóng tiền**: Bạn sẽ đóng tiền phòng tháng đầu tiên khi nhận phòng để dọn vào ở. Chủ trọ sẽ hỗ trợ bạn làm thủ tục **đăng ký tạm trú** đầy đủ theo đúng quy định của địa phương.`;

    case 'pet':
      return `Nhà trọ **không cho phép nuôi thú cưng** (chó, mèo, chim cảnh...) trong phòng.\n\nLý do: để giữ vệ sinh chung và tránh mùi hôi, tiếng ồn ảnh hưởng đến các phòng xung quanh.\n\nCảm ơn bạn đã hợp tác và tuân thủ nội quy!`;

    case 'security':
      return `Nhà trọ có hệ thống an ninh đảm bảo:\n- **Cổng khóa vân tay 2 lớp** – an toàn, tiện lợi\n- **Camera giám sát 24/7** tại hành lang và nhà xe\n\nBạn nên tự bảo quản tài sản cá nhân và khóa cổ/bánh xe máy cẩn thận để hạn chế rủi ro.`;

    case 'guest':
      return `Quy định về khách đến thăm:\n- **Bạn bè/người thân đến chơi trong ngày**: tự do, không cần báo trước\n- **Ngủ lại qua đêm**: cần khai báo họ tên, CMND/CCCD với chủ trọ **trước 22h00** để đảm bảo công tác khai báo cư trú`;

    case 'repair':
      return `Khi phát hiện thiết bị trong phòng hư hỏng:\n1. Gửi **yêu cầu sửa chữa** qua website (mục Yêu cầu sửa chữa)\n2. Hoặc liên hệ trực tiếp anh quản lý **${CONTACT_PHONE}**\n\nCác hư hỏng **hao mòn tự nhiên** được sửa chữa/thay thế **miễn phí**.`;

    case 'general_rules':
      return `Nội quy chính của nhà trọ:\n- Giữ vệ sinh khu vực chung\n- Không gây ồn sau **22h00**\n- Báo trước chủ trọ khi có người ở thêm\n- Báo ngay khi có thiết bị hư hỏng\n- Thanh toán đúng hạn ngày 5 hằng tháng\n\nBạn muốn hỏi quy định cụ thể nào hơn? (vật nuôi, dẫn khách, an ninh, sửa chữa...)`;

    case 'electricity_price':
    case 'water_price':
    case 'internet_price':
    case 'parking_price':
    case 'all_services':
      return await faqServicesReply(intent);

    case 'room_status_count': {
      if (!allRooms || allRooms.length === 0) {
        return `Hiện tại chưa có thông tin phòng trên hệ thống.`;
      }
      const total = allRooms.length;
      const available = allRooms.filter(r => r.status === 'available').length;
      const occupied = allRooms.filter(r => r.status === 'occupied').length;
      const maintenance = allRooms.filter(r => r.status === 'maintenance').length;
      return `Hiện tại nhà trọ Trang Thông đang có tổng cộng **${total}** phòng:\n` +
        `- 🟢 **${available}** phòng đang **trống** (sẵn sàng cho thuê)\n` +
        `- 🔴 **${occupied}** phòng đã **được thuê** (có người ở)\n` +
        `- 🛠️ **${maintenance}** phòng đang **bảo trì**\n\n` +
        `Bạn có muốn mình tìm các phòng trống theo khoảng giá hoặc diện tích cụ thể không? Ví dụ: "tìm phòng dưới 2 triệu".`;
    }

    case 'amenities_overview':
      return `Nhà trọ Trang Thông được trang bị đầy đủ các tiện ích hiện đại để mang lại sự tiện nghi và an tâm nhất cho bạn:\n\n` +
        `- 🌐 **WiFi cáp quang**: Đường truyền tốc độ cao ổn định.\n` +
        `- 🚽 **WC riêng khép kín**: Thiết kế sạch sẽ, riêng tư cho mỗi phòng.\n` +
        `- 🍳 **Khu vực bếp**: Có bệ bếp riêng để bạn thoải mái tự nấu ăn.\n` +
        `- 🛵 **Chỗ để xe an toàn**: Nhà giữ xe rộng rãi, cổng khóa vân tay bảo mật 2 lớp kết hợp camera an ninh 24/7.\n` +
        `- 📐 **Gác lửng đúc kiên cố**: Tối ưu diện tích sử dụng, phân chia khu vực ngủ và sinh hoạt rõ ràng.\n` +
        `- ❄️ **Điều hòa/Máy lạnh**: Sẵn có ở các phòng phân khúc tiêu chuẩn và phòng riêng rộng.\n` +
        `- 🪑 **Quạt trần & Bàn học**: Hỗ trợ đầy đủ góc học tập và sinh hoạt.\n` +
        `- 🧺 **Khu vực giặt phơi**: Khu vực giặt là và sân phơi đồ thông thoáng, sạch sẽ.\n\n` +
        `Bạn có muốn tìm phòng trống có sẵn tiện ích cụ thể nào không? (Ví dụ: "phòng có máy lạnh và wc riêng")`;

    case 'random_room': {
      if (!allRooms || allRooms.length === 0) {
        return `Hiện tại chưa có thông tin phòng trên hệ thống.`;
      }
      const availableRooms = allRooms.filter(r => r.status === 'available');
      const listToSelect = availableRooms.length ? availableRooms : allRooms;
      const randomRoom = listToSelect[Math.floor(Math.random() * listToSelect.length)];
      const detail = specificRoomReply(randomRoom.roomNumber, allRooms, tiers);
      return `Dưới đây là thông tin của một phòng ngẫu nhiên tại nhà trọ:\n\n${detail}`;
    }

    default:
      return null;
  }
};

// ─── Tổng quan bảng giá ───────────────────────────────────────────────────────

const priceTierOverviewReply = async (message, priceRange, tiers) => {
  const normalized = normalizeText(message);
  const wantsOverview = /(khung gia|muc gia|bang gia|phan khuc|cac loai gia|gia phong|gia thue|dien tich|loai phong)/.test(normalized);
  if (!wantsOverview || hasExplicitPrice(priceRange)) return null;
  const available = await Room.find({ status: 'available' }).select('price').lean();
  const counts = tiers.map(t => ({ ...t, count: available.filter(r => r.price >= t.min && r.price <= t.max).length }));
  const lines = counts.map(t => `- **${formatCurrency(t.target)}/tháng**: ${t.label} (${t.note}), còn **${t.count}** phòng trống.`).join('\n');
  return `Bảng giá và diện tích phòng hiện tại:\n\n${lines}\n\nBạn hỏi thêm về tầm giá, số người hoặc tiện nghi mong muốn để mình lọc phòng phù hợp nhé.`;
};

// ─── Main Handler ─────────────────────────────────────────────────────────────

export const chatWithBot = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Tin nhắn không được để trống' });
    }

    // Chuẩn bị dữ liệu
    const tiers = await getDynamicTiers();
    const allRooms = await Room.find({}).lean();
    const allRoomNumbers = allRooms.map(r => r.roomNumber);

    const tokens = tokenize(message);
    const explicitPriceRange = extractPriceRange(message);
    const priceRange = buildPriceFilters(message, explicitPriceRange, tiers);
    const areaRange = extractAreaRange(message);
    const capacity = extractCapacity(message);
    const amenities = extractAmenities(message);
    const floor = extractFloor(message);

    const hasPrice = hasExplicitPrice(explicitPriceRange);
    const hasRoomFilter = hasPrice || Boolean(areaRange.minArea || areaRange.maxArea || capacity || amenities.length || floor);

    // ── 1. Tìm intent tốt nhất ──────────────────────────────────────────────
    const rankedIntents = scoreIntents(message);
    const bestIntentId = rankedIntents[0]?.id ?? null;

    // ── 2. Phòng cụ thể ─────────────────────────────────────────────────────
    const matchedRoom = extractRoomNumber(message, allRoomNumbers);
    if (matchedRoom) {
      const reply = specificRoomReply(matchedRoom, allRooms, tiers);
      if (reply) return res.json({ success: true, data: { reply } });
    } else {
      const invalidRoomNum = detectInvalidRoomNumber(message, allRoomNumbers);
      if (invalidRoomNum) {
        return res.json({
          success: true,
          data: { reply: `Hiện tại nhà trọ Trang Thông không có phòng nào tên là **${invalidRoomNum}**. Bạn vui lòng kiểm tra lại số phòng nhé!` }
        });
      }
    }

    // ── 3. Trả lời theo intent (luôn kiểm tra trước room filter để FAQ thắng) ──
    const nonRoomIntents = new Set([
      'greeting', 'contact', 'address', 'deposit', 'payment', 'room_view', 'loft',
      'curfew', 'contract', 'electricity_price', 'water_price', 'internet_price',
      'parking_price', 'all_services', 'pet', 'security', 'guest', 'repair', 'general_rules',
      'room_status_count', 'amenities_overview', 'random_room'
    ]);

    // Nếu intent tốt nhất là FAQ rõ ràng → trả lời ngay, không cần xét hasRoomFilter
    if (bestIntentId && nonRoomIntents.has(bestIntentId)) {
      const reply = await replyByIntent(bestIntentId, tiers, allRooms);
      if (reply) return res.json({ success: true, data: { reply } });
    }

    // ── 4. Tổng quan bảng giá ────────────────────────────────────────────────
    if (bestIntentId === 'room_price_overview') {
      const reply = await priceTierOverviewReply(message, explicitPriceRange, tiers);
      if (reply) return res.json({ success: true, data: { reply } });
    }

    // ── 5. Phòng rẻ nhất / rộng nhất ─────────────────────────────────────────
    if (bestIntentId === 'room_cheapest' || bestIntentId === 'room_largest') {
      const isCheapest = bestIntentId === 'room_cheapest';
      const sort = isCheapest ? { price: 1, area: -1 } : { area: -1, price: 1 };
      const room = await Room.findOne({ status: 'available' }).sort(sort).lean();
      if (room) {
        const t = getPriceTier(room.price, tiers);
        const label = isCheapest ? 'Phòng tiết kiệm nhất' : 'Phòng rộng nhất';
        const tip = isCheapest ? 'Phù hợp sinh viên ưu tiên chi phí thấp.' : 'Phù hợp nếu bạn muốn không gian thoáng, ở 2–3 người.';
        const reply = `${label} đang trống:\n\n- Phòng: **${room.roomNumber}**\n- Giá: ${formatCurrency(room.price)}/tháng${t ? ` (${t.label})` : ''}\n- Diện tích: ${getRoomAreaText(room)}\n- Sức chứa: tối đa ${room.capacity || 'N/A'} người\n- Tầng: ${room.floor || 'N/A'}\n\n${tip}`;
        return res.json({ success: true, data: { reply } });
      }
    }

    // ── 6. Lọc phòng theo tiêu chí ───────────────────────────────────────────
    const asksForRoom = hasRoomFilter || bestIntentId === 'room_search';
    if (asksForRoom) {
      const filters = { ...priceRange, ...areaRange, capacity, amenities, floor };
      const query = buildRoomQuery(filters);
      const rooms = await Room.find(query).sort({ price: 1, roomNumber: 1 }).limit(20).lean();

      if (rooms.length) {
        const reply = buildRoomAdvice(rankRooms(rooms, filters), filters, tiers, false);
        return res.json({ success: true, data: { reply } });
      }

      const fallback = await Room.find({ status: 'available' }).sort({ price: 1, roomNumber: 1 }).limit(10).lean();
      const reply = fallback.length
        ? buildRoomAdvice(rankRooms(fallback, filters), filters, tiers, true)
        : `Hiện tại mình chưa thấy phòng trống trên hệ thống. Bạn liên hệ ${CONTACT_PHONE} để chủ trọ kiểm tra trực tiếp nhé.`;
      return res.json({ success: true, data: { reply } });
    }

    // ── 7. Câu hỏi ngoài phạm vi ─────────────────────────────────────────────
    if (!isInScope(tokens) && !hasPrice) {
      const reply = `Mình là trợ lý nhà trọ Trang Thông nên chỉ hỗ trợ các thông tin liên quan đến việc thuê phòng.\n\nMình có thể giúp bạn:\n- Tìm phòng theo giá, diện tích, số người\n- Hỏi về phí điện, nước, WiFi, giữ xe\n- Nội quy, hợp đồng, đặt cọc, thanh toán\n- Liên hệ chủ trọ\n\nBạn cần hỏi gì về nhà trọ không?`;
      return res.json({ success: true, data: { reply } });
    }

    // ── 8. Fallback mặc định ─────────────────────────────────────────────────
    const reply = `Mình có thể hỗ trợ:\n- Tìm phòng theo giá, diện tích, sức chứa\n- Lọc theo tiện nghi (WiFi, WC riêng, bếp, chỗ để xe)\n- Hướng dẫn liên hệ, cọc phòng, thanh toán hóa đơn và nội quy\n\nBạn hỏi tự nhiên nhé, ví dụ: "1tr4 có phòng không", "2 người ở phòng nào ổn", "phòng có WC riêng".`;
    return res.json({ success: true, data: { reply } });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
