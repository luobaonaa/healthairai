import { useAuth } from "@/_core/hooks/useAuth";
import ExploreSectionNav from "@/components/ExploreSectionNav";
import HealthAirLogo from "@/components/HealthAirLogo";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, MessageSquareText, Send } from "lucide-react";
import React from "react";
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";

export default function Feedback() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const submitFeedback = trpc.feedback.submit.useMutation({
    onSuccess: () => setMessage(""),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return setLocation("/login");
    submitFeedback.mutate({ message });
  };

  return (
    <main className="section-page feedback-page">
      <header className="section-header">
        <Link href="/" className="section-brand">
          <span>
              <HealthAirLogo />
          </span>
          HealthAir AI
        </Link>
        <ExploreSectionNav />
        <Link href="/explore" className="section-map-link">
          Buka peta <ArrowUpRight size={14} />
        </Link>
      </header>
      <section className="feedback-layout">
        <div className="feedback-copy">
          <span className="section-kicker">
            <MessageSquareText size={14} /> Masukan
          </span>
          <h1>Bantu HealthAir jadi lebih berguna di keseharian.</h1>
          <p>
            Ceritakan bagian yang membingungkan, data yang ingin Anda lihat,
            atau fitur yang paling Anda butuhkan. Masukan tersimpan pada akun
            Anda agar dapat ditindaklanjuti.
          </p>
          <div className="feedback-prompts">
            <span>“Saya ingin menerima peringatan…”</span>
            <span>“Grafik akan lebih membantu jika…”</span>
            <span>“Peta sulit digunakan saat…”</span>
          </div>
        </div>
        <form className="feedback-form" onSubmit={submit}>
          <label htmlFor="feedback-message">Masukan Anda</label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={event => setMessage(event.target.value)}
            minLength={8}
            maxLength={1000}
            placeholder="Tulis masukan dengan jelas…"
            required
          />
          <div>
            <small>{message.length}/1000</small>
            {submitFeedback.isSuccess && (
              <span className="feedback-success">
                Terima kasih, masukan terkirim.
              </span>
            )}
          </div>
          <button
            className="button button-primary"
            type="submit"
            disabled={submitFeedback.isPending}
          >
            {isAuthenticated ? (
              <>
                Kirim masukan <Send size={15} />
              </>
            ) : (
              <>
                Masuk untuk mengirim <ArrowUpRight size={15} />
              </>
            )}
          </button>
          {submitFeedback.error && (
            <p className="feedback-error">
              Masukan belum terkirim. Coba lagi sebentar.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
