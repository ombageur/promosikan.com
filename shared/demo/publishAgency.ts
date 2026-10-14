import type { AutomationSettings } from "../schemas/automation";
import { DEFAULT_AUTOMATION_SETTINGS } from "../schemas/automation";
import type { KeywordGroup, Offering } from "../schemas/catalog";
import { offeringSchema } from "../schemas/catalog";
import type { WorkspaceProfile } from "../schemas/workspace";
import { opportunityScore, type SubScores } from "../scoring";
import type { DailyStats, Intent, Lead, Opportunity, OfferingMatch, ReplyDraft } from "../types/intelligence";

/**
 * Data simulasi "Publish Agency" (SPEC §21). Dipakai demo publik /demo dan seeding
 * createDemoWorkspace. Semua nama & handle fiktif; tidak pernah dikirim ke platform sosial.
 */
export const DEMO_PROFILE: WorkspaceProfile = {
  name: "Demo — Publish Agency",
  businessName: "Publish Agency",
  industry: "Digital Marketing",
  website: "https://example.com",
  description: "Agency digital marketing yang membantu UMKM dan brand membangun kehadiran digital yang menghasilkan prospek.",
  location: "Surabaya, Indonesia",
  contactEmail: "",
  contactPhone: "",
  brandVoice: "Ramah, konsultatif, tidak memaksa; bertanya dulu sebelum menawarkan.",
  preferredLanguage: "id",
};

const offering = (input: Parameters<typeof offeringSchema.parse>[0]): Offering => offeringSchema.parse(input);

export const DEMO_OFFERINGS: (Offering & { id: string })[] = [
  {
    id: "seo",
    ...offering({
      name: "SEO Management",
      category: "Optimasi Mesin Pencari",
      description: "Strategi dan pengelolaan SEO untuk meningkatkan visibilitas di Google.",
      benefits: ["Traffic organik naik", "Ranking keyword bisnis", "Laporan bulanan transparan"],
      targetAudience: "Pemilik bisnis yang ingin meningkatkan traffic organik",
      problemsSolved: ["Website sulit ditemukan di Google", "Traffic website turun"],
      keywords: ["jasa SEO", "traffic website", "ranking Google", "optimasi website"],
      priceRange: "Mulai Rp3 juta/bulan",
      usp: "Audit teknis gratis di bulan pertama",
      allowedClaims: ["Audit SEO awal gratis", "Laporan progres setiap bulan"],
    }),
  },
  {
    id: "ads",
    ...offering({
      name: "Google Ads Management",
      category: "Iklan Digital",
      description: "Pengelolaan kampanye Google Ads dan optimasi konversi.",
      benefits: ["Prospek lebih relevan", "Biaya per konversi terkontrol"],
      targetAudience: "Bisnis yang ingin menjangkau pelanggan lewat iklan pencarian",
      problemsSolved: ["Iklan belum menghasilkan prospek relevan", "Penjualan toko online stagnan"],
      keywords: ["Google Ads", "jasa iklan", "iklan tidak efektif"],
      priceRange: "Fee 15% dari budget iklan",
      allowedClaims: ["Review akun iklan gratis"],
    }),
  },
  {
    id: "social",
    ...offering({
      name: "Social Media Management",
      category: "Media Sosial",
      description: "Perencanaan konten dan pengelolaan akun media sosial.",
      targetAudience: "Bisnis yang ingin konsisten di media sosial",
      problemsSolved: ["Konten tidak konsisten", "Interaksi akun rendah"],
      keywords: ["handle Instagram", "social media management", "admin sosmed"],
      priceRange: "Mulai Rp2,5 juta/bulan",
    }),
  },
  {
    id: "web",
    ...offering({
      name: "Website Development",
      category: "Pengembangan Web",
      description: "Pembuatan website company profile dan toko online.",
      targetAudience: "Bisnis yang membutuhkan website profesional",
      problemsSolved: ["Belum punya website", "Website lama sulit dikelola"],
      keywords: ["jasa website", "company profile", "toko online"],
      priceRange: "Mulai Rp5 juta",
    }),
  },
  {
    id: "kol",
    ...offering({
      name: "Influencer Marketing",
      category: "Kampanye Kreator",
      description: "Pemetaan, negosiasi, dan pengelolaan kolaborasi kreator/KOL.",
      targetAudience: "Brand yang ingin bekerja sama dengan kreator",
      problemsSolved: ["Sulit menemukan KOL yang relevan"],
      keywords: ["KOL", "influencer", "campaign kreator"],
    }),
  },
];

export const DEMO_KEYWORD_GROUPS: (KeywordGroup & { id: string; terms: string[] })[] = [
  { id: "g-seo", name: "SEO", offeringId: "seo", terms: ["butuh jasa SEO", "cari agency SEO", "website sepi pengunjung", "traffic turun"] },
  { id: "g-web", name: "Website", offeringId: "web", terms: ["cari jasa website", "butuh website perusahaan", "website company profile"] },
  { id: "g-dm", name: "Digital Marketing", offeringId: "ads", terms: ["cari digital agency", "butuh jasa iklan", "rekomendasi agency"] },
  { id: "g-kol", name: "Influencer Marketing", offeringId: "kol", terms: ["cari KOL", "butuh influencer", "agency KOL"] },
];

export const DEMO_AUTOMATION: AutomationSettings = { ...DEFAULT_AUTOMATION_SETTINGS, minOpportunityScore: 60 };

// ---------- Data intelijen (hanya frontend demo) ----------

const DAY = 24 * 60 * 60 * 1000;
const isoDaysAgo = (now: number, days: number, hour = 10) => {
  const d = new Date(now - days * DAY);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
};

const offeringName = (id: string) => DEMO_OFFERINGS.find((o) => o.id === id)?.name ?? id;
const match = (offeringId: string, matchScore: number, approach: OfferingMatch["approach"], reason: string): OfferingMatch => ({
  offeringId,
  offeringName: offeringName(offeringId),
  matchScore,
  approach,
  reason,
});

type Seed = {
  id: string;
  daysAgo: number;
  authorName: string;
  authorHandle: string;
  text: string;
  keyword: string;
  intent: Intent;
  problem: string;
  subScores: SubScores;
  reasons: string[];
  matches: OfferingMatch[];
  reply: string;
  redFlags?: string[];
};

const SEEDS: Seed[] = [
  {
    id: "op-101",
    daysAgo: 0,
    authorName: "Nadia Putri",
    authorHandle: "@nadia.usaha",
    text: "Ada rekomendasi agency SEO Surabaya? Website bisnis saya susah banget muncul di Google.",
    keyword: "cari agency SEO",
    intent: "asking_recommendation",
    problem: "Website sulit ditemukan di Google",
    subScores: { buyingIntent: 95, productRelevance: 96, urgency: 80, problemClarity: 90, conversationSuitability: 95 },
    reasons: ["Meminta rekomendasi jasa secara eksplisit", "Lokasi sesuai area layanan", "Masalah cocok dengan layanan SEO"],
    matches: [match("seo", 96, "consultative", "Masalah visibilitas Google adalah inti layanan SEO Management.")],
    reply:
      "Halo Kak! Boleh tahu websitenya bergerak di bidang apa? Biasanya langkah awal SEO tergantung target pasar dan kondisi teknis situs. Kalau berkenan, kami di Publish Agency bisa bantu audit awal gratis.",
  },
  {
    id: "op-102",
    daysAgo: 0,
    authorName: "Raka Pratama",
    authorHandle: "@raka.brand",
    text: "Cari KOL buat campaign skincare lokal. Ada saran cara milih kreator yang tepat?",
    keyword: "cari KOL",
    intent: "active_search",
    problem: "Menemukan kreator yang relevan untuk kampanye",
    subScores: { buyingIntent: 85, productRelevance: 93, urgency: 70, problemClarity: 85, conversationSuitability: 90 },
    reasons: ["Kebutuhan KOL disebut langsung", "Industri skincare cocok untuk kampanye kreator"],
    matches: [
      match("kol", 93, "helpful", "Butuh pemetaan kreator — sesuai layanan Influencer Marketing."),
      match("social", 61, "helpful", "Konten kampanye bisa didukung pengelolaan media sosial."),
    ],
    reply:
      "Untuk skincare, relevansi audiens dan gaya konten kreator biasanya lebih penting daripada jumlah follower. Target audiens campaign-nya siapa, Kak? Dari situ lebih mudah memetakan kriteria KOL-nya.",
  },
  {
    id: "op-103",
    daysAgo: 1,
    authorName: "Dimas Anwar",
    authorHandle: "@dimas.bisnis",
    text: "Butuh website company profile untuk usaha baru. Sebaiknya mulai dari mana ya?",
    keyword: "website company profile",
    intent: "active_search",
    problem: "Belum memiliki website perusahaan",
    subScores: { buyingIntent: 85, productRelevance: 95, urgency: 70, problemClarity: 80, conversationSuitability: 90 },
    reasons: ["Kebutuhan website disebut langsung", "Usaha baru — momen tepat untuk dibantu"],
    matches: [match("web", 95, "helpful", "Kebutuhan company profile sesuai layanan Website Development.")],
    reply:
      "Selamat atas usaha barunya! Langkah awal biasanya menentukan tujuan website, halaman inti, dan siapa pengunjung utamanya. Usahanya bergerak di bidang apa, Kak?",
  },
  {
    id: "op-104",
    daysAgo: 1,
    authorName: "Salsa Mahira",
    authorHandle: "@salsa.store",
    text: "Agency digital marketing yang bagus apa ya buat toko online kecil?",
    keyword: "rekomendasi agency",
    intent: "asking_recommendation",
    problem: "Butuh dukungan pemasaran digital, kebutuhan belum spesifik",
    subScores: { buyingIntent: 80, productRelevance: 74, urgency: 55, problemClarity: 50, conversationSuitability: 85 },
    reasons: ["Ada niat mencari agency", "Kebutuhan layanan spesifik belum jelas"],
    matches: [
      match("ads", 74, "consultative", "Toko online sering butuh iklan pencarian untuk penjualan."),
      match("social", 70, "consultative", "Bisa juga butuh konsistensi konten."),
    ],
    reply:
      "Boleh cerita target utama toko online-nya sekarang, Kak: menambah traffic, memperbaiki iklan, atau mengelola konten? Dari situ lebih mudah menentukan bantuan yang tepat.",
  },
  {
    id: "op-105",
    daysAgo: 2,
    authorName: "Fajar Rizki",
    authorHandle: "@fajar.growth",
    text: "Ada yang bisa bantu Google Ads? Iklan jalan tapi leads-nya kurang relevan.",
    keyword: "butuh jasa iklan",
    intent: "active_search",
    problem: "Kualitas prospek dari iklan rendah",
    subScores: { buyingIntent: 92, productRelevance: 97, urgency: 85, problemClarity: 90, conversationSuitability: 90 },
    reasons: ["Meminta bantuan secara langsung", "Masalah spesifik dan cocok dengan layanan Google Ads"],
    matches: [match("ads", 97, "consultative", "Masalah kualitas leads iklan adalah fokus Google Ads Management.")],
    reply:
      "Biasanya ini bisa ditelusuri dari keyword, target lokasi, dan halaman tujuan iklannya. Sudah sempat cek laporan istilah pencarian yang memicu iklan, Kak?",
  },
  {
    id: "op-106",
    daysAgo: 3,
    authorName: "Intan Dewi",
    authorHandle: "@intan.shop",
    text: "Website toko online saya traffic-nya turun belakangan ini. Ada yang pernah mengalami?",
    keyword: "traffic turun",
    intent: "problem_aware",
    problem: "Penurunan traffic website",
    subScores: { buyingIntent: 45, productRelevance: 83, urgency: 65, problemClarity: 75, conversationSuitability: 80 },
    reasons: ["Masalah terkait SEO", "Belum ada sinyal mencari jasa — cocok untuk balasan edukatif"],
    matches: [match("seo", 83, "helpful", "Penurunan traffic organik bisa ditangani dengan audit SEO.")],
    reply:
      "Pernah, Kak. Langkah awal biasanya cek apakah penurunannya dari pencarian organik, iklan, atau kanal lain. Sudah sempat lihat sumber traffic yang turun?",
  },
  {
    id: "op-107",
    daysAgo: 4,
    authorName: "Bima Santoso",
    authorHandle: "@bima.kuliner",
    text: "Butuh freelancer atau agency buat handle Instagram bisnis kuliner. Ada rekomendasi?",
    keyword: "rekomendasi agency",
    intent: "asking_recommendation",
    problem: "Pengelolaan Instagram bisnis",
    subScores: { buyingIntent: 85, productRelevance: 91, urgency: 65, problemClarity: 80, conversationSuitability: 90 },
    reasons: ["Kebutuhan pengelolaan akun jelas", "Meminta rekomendasi penyedia"],
    matches: [match("social", 91, "friendly", "Pengelolaan Instagram adalah inti Social Media Management.")],
    reply:
      "Untuk akun kuliner, tujuan utamanya penting diketahui dulu: awareness, kunjungan ke outlet, atau pesanan online. Saat ini paling ingin meningkatkan yang mana, Kak?",
  },
  {
    id: "op-108",
    daysAgo: 5,
    authorName: "Akun Anonim",
    authorHandle: "@curhat.malam",
    text: "Lagi stres banget usaha sepi, utang numpuk, nggak tahu harus gimana lagi.",
    keyword: "usaha sepi",
    intent: "general_discussion",
    problem: "Kesulitan finansial pribadi",
    subScores: { buyingIntent: 10, productRelevance: 30, urgency: 60, problemClarity: 40, conversationSuitability: 10 },
    reasons: ["Percakapan sensitif — tidak pantas ditawari jasa"],
    redFlags: ["Topik keuangan pribadi yang rentan"],
    matches: [],
    reply: "",
  },
];

/** Bangun data intelijen demo relatif terhadap `now`, agar tanggal selalu terlihat baru. */
export function buildDemoIntelligence(now = Date.now()) {
  const opportunities: Opportunity[] = SEEDS.map((seed) => {
    const { score, band } = opportunityScore(seed.subScores);
    return {
      id: seed.id,
      post: {
        id: `threads_demo_${seed.id}`,
        platform: "threads",
        authorName: seed.authorName,
        authorHandle: seed.authorHandle,
        text: seed.text,
        postedAt: isoDaysAgo(now, seed.daysAgo, 9 + (seed.id.charCodeAt(5) % 8)),
        matchedKeyword: seed.keyword,
        permalink: null,
      },
      intent: seed.intent,
      customerProblem: seed.problem,
      subScores: seed.subScores,
      score,
      band,
      reasons: seed.reasons,
      redFlags: seed.redFlags ?? [],
      matches: seed.matches,
      status: "new",
    };
  });

  const replyDrafts: ReplyDraft[] = SEEDS.filter((s) => s.reply).map((seed) => ({
    id: `draft-${seed.id}`,
    opportunityId: seed.id,
    text: seed.reply,
    style: seed.matches[0]?.approach ?? "consultative",
    status: "pending_approval",
    quality: { passed: true, notes: ["Relevan dengan post", "Tidak ada klaim di luar katalog", "Panjang sesuai batas"] },
    publishable: false,
  }));

  const leads: Lead[] = [
    { id: "ld-1", name: "Nadia Putri", handle: "@nadia.usaha", platform: "threads", status: "qualified", offeringName: "SEO Management", score: 91, assigneeName: "Rina (Marketing)", lastActivityAt: isoDaysAgo(now, 0), note: "Minta audit awal.", dealValue: null },
    { id: "ld-2", name: "Fajar Rizki", handle: "@fajar.growth", platform: "threads", status: "replied", offeringName: "Google Ads Management", score: 91, assigneeName: "Rina (Marketing)", lastActivityAt: isoDaysAgo(now, 1), note: "", dealValue: null },
    { id: "ld-3", name: "Bima Santoso", handle: "@bima.kuliner", platform: "threads", status: "engaged", offeringName: "Social Media Management", score: 84, assigneeName: "Sam (Sales)", lastActivityAt: isoDaysAgo(now, 2), note: "Tertarik paket 3 bulan.", dealValue: null },
    { id: "ld-4", name: "Raka Pratama", handle: "@raka.brand", platform: "threads", status: "matched", offeringName: "Influencer Marketing", score: 85, assigneeName: null, lastActivityAt: isoDaysAgo(now, 0), note: "", dealValue: null },
    { id: "ld-5", name: "Dimas Anwar", handle: "@dimas.bisnis", platform: "threads", status: "reply_drafted", offeringName: "Website Development", score: 84, assigneeName: null, lastActivityAt: isoDaysAgo(now, 1), note: "", dealValue: null },
    { id: "ld-6", name: "Lestari Ayu", handle: "@lestari.craft", platform: "threads", status: "negotiation", offeringName: "Website Development", score: 88, assigneeName: "Sam (Sales)", lastActivityAt: isoDaysAgo(now, 3), note: "Menunggu persetujuan budget.", dealValue: 7500000 },
    { id: "ld-7", name: "Hendra Wijaya", handle: "@hendra.properti", platform: "threads", status: "converted", offeringName: "Google Ads Management", score: 90, assigneeName: "Sam (Sales)", lastActivityAt: isoDaysAgo(now, 6), note: "Kontrak 6 bulan.", dealValue: 18000000 },
    { id: "ld-8", name: "Maya Sari", handle: "@maya.fashion", platform: "threads", status: "lost", offeringName: "Social Media Management", score: 72, assigneeName: "Rina (Marketing)", lastActivityAt: isoDaysAgo(now, 9), note: "Memilih freelancer.", dealValue: null },
    { id: "ld-9", name: "Intan Dewi", handle: "@intan.shop", platform: "threads", status: "discovered", offeringName: "SEO Management", score: 64, assigneeName: null, lastActivityAt: isoDaysAgo(now, 3), note: "", dealValue: null },
  ];

  // Statistik harian 30 hari, deterministik (tanpa Math.random) agar demo stabil.
  const dailyStats: DailyStats[] = Array.from({ length: 30 }, (_, i) => {
    const daysAgo = 29 - i;
    const wave = Math.round(6 * Math.sin(i / 3) + i * 0.6);
    const discovered = 18 + wave + (i % 4);
    const qualified = Math.round(discovered * 0.42);
    const matched = Math.round(qualified * 0.8);
    const drafts = Math.round(matched * 0.85);
    const repliesSent = Math.round(drafts * 0.6);
    const engaged = Math.round(repliesSent * 0.45);
    const converted = i % 6 === 5 ? 1 : 0;
    return {
      date: isoDaysAgo(now, daysAgo).slice(0, 10),
      discovered,
      qualified,
      matched,
      drafts,
      repliesSent,
      engaged,
      converted,
    };
  });

  return { opportunities, replyDrafts, leads, dailyStats };
}

export type DemoIntelligence = ReturnType<typeof buildDemoIntelligence>;
