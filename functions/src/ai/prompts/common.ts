import type { Offering } from "@shared/schemas/catalog";
import type { WorkspaceProfile } from "@shared/schemas/workspace";

export type CatalogItem = Offering & { id: string };

/**
 * Teks dari pihak ketiga (post sosial) dibungkus tag dan tidak boleh bisa "menutup" tagnya sendiri,
 * sehingga instruksi di dalamnya tidak bisa menyamar menjadi instruksi sistem (SPEC §11).
 */
export function untrusted(tag: string, text: string): string {
  const safe = text.replace(/<\/?\s*([a-z_]+)[^>]*>/gi, (m) => m.replace(/</g, "‹").replace(/>/g, "›"));
  return `<${tag}>\n${safe}\n</${tag}>`;
}

export function businessContext(profile: WorkspaceProfile, catalog: CatalogItem[]): string {
  const lines = [
    "# Profil bisnis",
    `Nama: ${profile.businessName}`,
    profile.industry && `Industri: ${profile.industry}`,
    profile.location && `Lokasi: ${profile.location}`,
    profile.description && `Deskripsi: ${profile.description}`,
    profile.brandVoice && `Brand voice: ${profile.brandVoice}`,
    "",
    "# Katalog produk/layanan aktif",
    catalog.length === 0 ? "(Katalog kosong — tidak ada yang bisa dicocokkan.)" : "",
    ...catalog.map((o) =>
      [
        `## [${o.id}] ${o.name} (${o.type === "product" ? "produk" : "layanan"})`,
        o.category && `Kategori: ${o.category}`,
        o.description && `Deskripsi: ${o.description}`,
        o.targetAudience && `Target: ${o.targetAudience}`,
        o.problemsSolved.length > 0 && `Masalah yang diselesaikan: ${o.problemsSolved.join("; ")}`,
        o.keywords.length > 0 && `Keyword: ${o.keywords.join(", ")}`,
        o.priceRange && `Harga: ${o.priceRange}`,
        o.usp && `Keunggulan: ${o.usp}`,
        `Klaim yang boleh disebut: ${o.allowedClaims.length > 0 ? o.allowedClaims.join("; ") : "(tidak ada — jangan membuat klaim)"}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ];
  // Field kosong menghasilkan baris kosong; rapikan agar prompt (dan cache-nya) stabil.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
