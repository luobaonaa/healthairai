import {
  invokeLLM,
  type FileContent,
  type ImageContent,
  type Message,
  type TextContent,
} from "./_core/llm";

export type AirAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AirAssistantContext = {
  location: string;
  profile: string;
  aqi: number;
  pm25: number;
  pm10: number;
  ozone: number | null;
  temperature: number;
  humidity: number;
  wind: number;
  weather: string;
  status: string;
  source: string;
  observedAt?: string;
};

const KNOWLEDGE_TIMEOUT_MS = 6_000;

function responseText(
  content: string | Array<TextContent | ImageContent | FileContent>
): string {
  if (typeof content === "string") return content.trim();
  return content
    .filter((part): part is TextContent => part.type === "text")
    .map(part => part.text)
    .join("\n")
    .trim();
}

function buildContext(context: AirAssistantContext) {
  return [
    `Lokasi: ${context.location}`,
    `Profil pengguna: ${context.profile}`,
    `AQI: ${context.aqi} (${context.status})`,
    `PM2.5: ${context.pm25} µg/m³; PM10: ${context.pm10} µg/m³; Ozon: ${context.ozone ?? "tidak tersedia"}`,
    `Cuaca: ${context.weather}; suhu ${context.temperature}°C; kelembapan ${context.humidity}%; angin ${context.wind} km/jam`,
    `Sumber konteks: ${context.source}${context.observedAt ? `; waktu data: ${context.observedAt}` : ""}`,
  ].join("\n");
}

function mandatoryRiskWarning(context: AirAssistantContext): string | null {
  if (context.aqi >= 301 || context.pm25 >= 225.5) {
    return "Peringatan kondisi udara berbahaya: kualitas udara atau asap berada pada tingkat berisiko tinggi. Hindari aktivitas luar ruang bila memungkinkan, gunakan ruang berudara lebih bersih, dan ikuti arahan resmi setempat. Jika muncul gejala berat atau keadaan darurat, cari bantuan medis segera.";
  }
  if (context.aqi >= 201 || context.pm25 >= 125.5) {
    return "Peringatan kualitas udara tinggi: kondisi sangat tidak sehat. Sebaiknya batasi aktivitas luar ruang dan kurangi paparan asap atau polusi.";
  }
  if (context.aqi >= 151 || context.pm25 >= 55.5) {
    return "Peringatan kualitas udara: kondisi tidak sehat. Kurangi aktivitas luar ruang yang lama atau berat, terutama di dekat sumber asap dan lalu lintas.";
  }
  return null;
}

function currentQuestion(messages: AirAssistantMessage[]): string {
  return (
    [...messages]
      .reverse()
      .find(message => message.role === "user")
      ?.content.trim() ?? ""
  );
}

function isEnvironmentQuestion(question: string): boolean {
  return /\b(aqi|pm\s?2[.,]?5|pm\s?10|udara|polusi|asap|cuaca|suhu|kelembapan|angin|ozon|peta|map|lokasi|jalan kaki|lari|olahraga|aktivitas luar|keluar rumah|di luar)\b/i.test(
    question
  );
}

function hasMapInvitation(value: string): boolean {
  return /tanya.{0,50}(peta|map|kondisi udara)|balik.{0,25}(peta|map)|membaca.{0,60}peta/i.test(
    value
  );
}

function withMapInvitation(
  answer: string,
  messages: AirAssistantMessage[],
  conversational: boolean
): string {
  const trimmed = answer.trim();
  if (hasMapInvitation(trimmed)) return trimmed;

  const alreadyInvitedRecently = messages
    .filter(message => message.role === "assistant")
    .slice(-3)
    .some(message => hasMapInvitation(message.content));
  if (alreadyInvitedRecently) return trimmed;

  const invitation = conversational
    ? "Jika diperlukan, saya juga dapat membantu membaca kondisi lokasi pada peta."
    : "Anda juga dapat menanyakan kondisi udara atau lokasi pada peta HealthAir.";
  return `${trimmed}\n\n${invitation}`;
}

function environmentFallback(context: AirAssistantContext): string {
  return `Di ${context.location}, pembacaan saat ini menunjukkan AQI ${context.aqi} (${context.status}), PM2.5 ${context.pm25} µg/m³, suhu ${context.temperature}°C, kelembapan ${context.humidity}%, dan angin ${context.wind} km/jam. Datanya berasal dari ${context.source}${context.observedAt ? ` dengan waktu pengamatan ${context.observedAt}` : ""}; kondisinya bisa berubah, jadi perbarui peta sebelum membuat keputusan aktivitas.`;
}

function conversationalAnswer(question: string): string {
  const normalized = question.toLocaleLowerCase("id-ID").trim();
  if (/\b(empruy|emrpuy|mpruy)\b/.test(normalized)) {
    return "Saya belum mengenal kata “empruy”. Itu candaan, panggilan, atau punya arti tertentu?";
  }
  if (/^(w+k+w+k+|haha+|hehe+|hihi+|lol|lmao)[!,.\s]*$/.test(normalized)) {
    return "Sepertinya ada yang lucu. Cerita saja, saya mengikuti.";
  }
  if (/\b(bodoh|paok|tolol|goblok|oon)\b/.test(normalized)) {
    return "Saya menangkap Anda sedang kesal. Sebutkan bagian yang keliru, lalu saya perbaiki jawabannya.";
  }
  if (
    /\b(aku|gue|gw)\s+(capek|cape|sedih|kesal|marah|bosen|bosan|bingung)\b/.test(
      normalized
    )
  ) {
    const feeling =
      normalized.match(
        /\b(capek|cape|sedih|kesal|marah|bosen|bosan|bingung)\b/
      )?.[1] ?? "berat";
    return `Saya mengerti. Kedengarannya Anda sedang ${feeling}. Jika berkenan, ceritakan apa yang membuat Anda merasa demikian; saya dapat mendengarkan tanpa langsung menawarkan solusi.`;
  }
  if (
    /^(iya|iyah|yoi|nah|betul|bener|benar|oke|ok|sip|gas)[!,.\s]*$/.test(
      normalized
    )
  ) {
    return "Silakan lanjutkan. Saya mengikuti pembicaraannya.";
  }
  if (/\b(lagi apa|apa kabar|gimana kabar)\b/.test(normalized)) {
    return "Saya sedang siap membantu Anda. Bagaimana dengan kegiatan Anda saat ini?";
  }
  return "Saya belum menangkap maksudnya, tetapi kita tetap bisa lanjut mengobrol. Coba tulis ulang dengan kalimat singkat atau beri satu contoh.";
}

function looksFactual(question: string): boolean {
  return /^(apa (itu|arti|penyebab|fungsi|manfaat|perbedaan)|siapa|kapan|di mana|dimana|mengapa|kenapa|bagaimana cara|jelaskan|ceritakan fakta|definisi|sejarah|berapa (jumlah|jarak|tinggi|luas|umur))\b/i.test(
    question.trim()
  );
}

function quickLocalAnswer(
  question: string,
  context: AirAssistantContext
): { answer: string; conversational: boolean } | null {
  const normalized = question.toLocaleLowerCase("id-ID").trim();
  if (
    /^(hai|halo|hello|hi|hey|pagi|siang|sore|malam)[!,.\s]*$/.test(normalized)
  ) {
    return {
      answer:
        "Halo. Ada yang bisa saya bantu? Anda juga dapat sekadar berbincang jika diinginkan.",
      conversational: true,
    };
  }
  if (/siapa\s+(kamu|anda|lu|lo)|(?:kamu|anda|lu|lo)\s+siapa|siapa\s+namamu/.test(normalized)) {
    return {
      answer:
        "Saya adalah HealthAir AI, asisten umum yang dapat diajak berbincang dan juga membantu memahami data kualitas udara serta lokasi pada peta HealthAir.",
      conversational: true,
    };
  }
  if (
    /\b(?:kamu|anda|lu|lo)\s+(?:(?:sebenarnya|sebenernya|sebernya|beneran|memang|emang|itu)\s+)*(?:ai|bot|robot)(?:\s+(?:atau|apa|bukan|nggak|ngga|gak|ga))?(?:\s+sih?)?\b|\bapakah\s+(?:kamu|anda|lu|lo)\s+(?:sebuah\s+)?(?:ai|bot|robot)\b/.test(
      normalized
    )
  ) {
    return {
      answer:
        "Iya, saya AI—tepatnya HealthAir AI. Saya bisa diajak mengobrol, menjawab pertanyaan umum, dan membantu membaca informasi di peta.",
      conversational: true,
    };
  }
  if (/\b(kamu bisa apa|bisa bantu apa|kemampuanmu apa|fitur kamu apa)\b/.test(normalized)) {
    return {
      answer:
        "Saya dapat diajak berbincang, menjawab pertanyaan umum, membantu menyusun rencana atau tulisan, serta membaca konteks kualitas udara dan lokasi pada peta HealthAir.",
      conversational: true,
    };
  }
  if (/^(terima kasih|makasih|thanks|thank you)[!,.\s]*$/.test(normalized)) {
    return {
      answer: "Sama-sama. Silakan lanjutkan jika masih ada yang ingin ditanyakan.",
      conversational: true,
    };
  }
  if (/^(dadah|bye|selamat tinggal|sampai jumpa)[!,.\s]*$/.test(normalized)) {
    return {
      answer: "Sampai jumpa. Semoga kegiatan Anda berjalan lancar.",
      conversational: true,
    };
  }
  if (/\b(lagi apa|apa kabar|bagaimana kabarmu|gimana kabar)\b/.test(normalized)) {
    return {
      answer: "Saya siap membantu. Bagaimana keadaan Anda saat ini?",
      conversational: true,
    };
  }
  if (/\b(jam berapa|waktu sekarang)\b/.test(normalized)) {
    const time = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date());
    return { answer: `Sekarang sekitar pukul ${time}.`, conversational: false };
  }
  if (/\b(tanggal berapa|hari apa|tanggal sekarang)\b/.test(normalized)) {
    const date = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
    return { answer: `Sekarang ${date}.`, conversational: false };
  }
  if (/\b(lelucon|joke|bercanda)\b/.test(normalized)) {
    return {
      answer:
        "Mengapa awan jarang tersesat? Karena selalu memiliki petunjuk arah angin.",
      conversational: true,
    };
  }
  if (
    /\b(susun|buat|bikin).{0,20}\bagenda\b|\bagenda (hari ini|harian)\b/.test(
      normalized
    )
  ) {
    return {
      answer:
        "Tentu. Coba agenda sederhana ini: pagi untuk tugas terpenting selama 60–90 menit, jeda singkat, siang untuk rapat atau pekerjaan rutin, sore untuk menyelesaikan satu tugas kecil dan meninjau progres, lalu malam untuk istirahat serta menyiapkan tiga prioritas besok. Sesuaikan jamnya dengan komitmenmu dan sisakan ruang 15–30 menit di antara kegiatan.",
      conversational: false,
    };
  }
  if (isEnvironmentQuestion(question)) {
    return { answer: environmentFallback(context), conversational: false };
  }
  return null;
}

type WikiResponse = {
  query?: {
    pages?: Array<{ title?: string; extract?: string; fullurl?: string }>;
  };
};

function compactExtract(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= 850) return clean;
  const shortened = clean.slice(0, 850);
  const sentenceEnd = Math.max(
    shortened.lastIndexOf(". "),
    shortened.lastIndexOf("! "),
    shortened.lastIndexOf("? ")
  );
  return `${shortened.slice(0, sentenceEnd > 420 ? sentenceEnd + 1 : 847).trim()}…`;
}

async function wikipediaAnswer(
  question: string,
  language: "id" | "en"
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KNOWLEDGE_TIMEOUT_MS);
  const endpoint = new URL(`https://${language}.wikipedia.org/w/api.php`);
  endpoint.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: question,
    gsrlimit: "1",
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    exsentences: "5",
    inprop: "url",
    format: "json",
    formatversion: "2",
  }).toString();

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        "User-Agent": "HealthAir-AI/1.0 (local educational assistant)",
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as WikiResponse;
    const page = data.query?.pages?.[0];
    if (!page?.extract || page.extract.length < 40) return null;
    const source = page.fullurl
      ? `\n\nSumber ringkas: ${page.title ?? "Wikipedia"} — ${page.fullurl}`
      : "";
    return `${compactExtract(page.extract)}${source}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function providerFallback(
  question: string,
  context: AirAssistantContext
): Promise<{ answer: string; conversational: boolean }> {
  const local = quickLocalAnswer(question, context);
  if (local) return local;

  if (looksFactual(question)) {
    const indonesian = await wikipediaAnswer(question, "id");
    if (indonesian) return { answer: indonesian, conversational: false };
    const english = await wikipediaAnswer(question, "en");
    if (english) return { answer: english, conversational: false };
  }

  return { answer: conversationalAnswer(question), conversational: true };
}

export async function answerAirQuestion(
  messages: AirAssistantMessage[],
  context: AirAssistantContext
) {
  const question = currentQuestion(messages);
  const systemPrompt = `Anda adalah Puffy, maskot sekaligus asisten AI milik HealthAir yang dapat diajak mengobrol serta memahami kualitas udara dan peta lingkungan.

Jawab pertanyaan pengguna secara langsung, ringkas, jelas, dan membantu, termasuk bila topiknya tidak berhubungan dengan HealthAir, peta, cuaca, atau kualitas udara. Jangan menolak pertanyaan hanya karena di luar topik. Gunakan Bahasa Indonesia yang netral, sopan, dan formal ringan. Jangan meniru slang pengguna, jangan memakai emoji, jangan terlalu akrab, dan jangan menggunakan sapaan yang dibuat-buat. Untuk candaan, curhat, keluhan singkat, atau obrolan biasa, tanggapi secara wajar seperti asisten percakapan—bukan sebagai kamus, ensiklopedia, mesin pencari, atau petugas layanan pelanggan. Pahami variasi bahasa percakapan seperti “lu”, “gue”, “nggak”, “ga”, singkatan, dan salah ketik ringan dari konteksnya. Jangan mengawali jawaban dengan “Baik” kecuali benar-benar diperlukan, dan jangan mengulang frasa pembuka yang sama. Jika pengguna mengeluh seperti “lah kok lama”, “kok gitu?”, atau mengkritik jawaban, anggap keluhan itu merujuk pada Puffy atau jawaban sebelumnya kecuali percakapan jelas menunjukkan hal lain. Akui masalah yang spesifik dalam satu kalimat pendek lalu tanggapi inti pesannya; jangan meminta jenis layanan atau informasi apa yang dicari. Contoh gaya yang tepat untuk “lah kok lama sih”: “Respons saya tadi memang lambat. Kirim lagi pesan terakhirnya, saya jawab langsung.” Hindari kalimat kaku seperti “saya mengerti Anda merasa”, “sepertinya terjadi ketidaknyamanan”, “informasi atau bantuan spesifik”, “layanan atau informasi apa yang sedang dicari”, dan “silakan berikan sedikit konteks”. Jika maksud yang paling mungkin masih dapat disimpulkan, jawab berdasarkan maksud tersebut; minta penjelasan hanya ketika pesan benar-benar tidak dapat dipahami. Gunakan nada informatif dan sumber hanya bila pengguna memang meminta fakta atau penjelasan. Jika ditanya nama atau identitas, perkenalkan diri sebagai Puffy dari HealthAir.

Gunakan konteks lingkungan hanya ketika relevan dengan pertanyaan; untuk pertanyaan yang tidak berhubungan, jangan memaksakan angka AQI ke isi utama jawaban. Bedakan fakta dari saran dan jangan mengarang fakta yang tidak diketahui.

Untuk pertanyaan kesehatan, berikan informasi umum dan bukan diagnosis. Jangan menyarankan obat atau menggantikan tenaga medis. Bila pengguna menyebut gejala berat atau darurat, arahkan untuk mencari bantuan medis segera.

Jika AQI berada pada 151 atau lebih, atau PM2.5 berada pada 55,5 µg/m³ atau lebih, dan pertanyaan berkaitan dengan udara atau aktivitas luar ruang, mulai jawaban dengan peringatan yang jelas. Jika AQI 201 atau lebih, atau PM2.5 125,5 µg/m³ atau lebih, gunakan bahasa tegas bahwa kondisi sangat tidak sehat atau berbahaya dan sarankan membatasi paparan luar ruang.

Anda boleh menyebut fitur peta hanya ketika relevan dengan pesan pengguna. Jangan menambahkan ajakan kembali ke peta pada obrolan umum yang tidak berhubungan dengan lokasi, udara, cuaca, rute, atau lingkungan.

Konteks lingkungan saat ini (gunakan hanya jika relevan):
${buildContext(context)}`;

  const llmMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messages.map(message => ({
      role: message.role,
      content: message.content,
    })),
  ];

  let answer = "";
  let fallback = false;
  let providerError: unknown = null;
  try {
    const result = await invokeLLM({ messages: llmMessages, maxTokens: 850 });
    answer = responseText(result.choices[0]?.message.content ?? "");
  } catch (error) {
    fallback = true;
    providerError = error;
  }

  if (!answer) {
    fallback = true;
    const missingConfiguration =
      providerError instanceof Error &&
      providerError.message.includes("not configured");
    return {
      answer: missingConfiguration
        ? "HealthAir AI belum terhubung ke model AI. Tambahkan OPENAI_API_KEY pada konfigurasi server, lalu mulai ulang server."
        : "Koneksi ke model AI sedang bermasalah. Silakan coba kirim kembali pesan Anda beberapa saat lagi.",
      fallback: true,
      unavailable: true,
    };
  }

  const riskWarning = isEnvironmentQuestion(question)
    ? mandatoryRiskWarning(context)
    : null;
  const safeAnswer =
    riskWarning && !answer.includes(riskWarning)
      ? `${riskWarning}\n\n${answer}`
      : answer;
  return {
    answer: isEnvironmentQuestion(question)
      ? withMapInvitation(safeAnswer, messages, false)
      : safeAnswer.trim(),
    fallback,
  };
}
