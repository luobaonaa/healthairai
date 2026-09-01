import { trpc } from "@/lib/trpc";
import HealthAirLogo from "@/components/HealthAirLogo";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import "./LocalAuth.css";

export default function LocalAuth({ mode }: { mode: "login" | "register" }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/explore");
    },
  });
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/explore");
    },
  });
  const pending = register.isPending || login.isPending;
  const isRegister = mode === "register";
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (isRegister && password !== confirmPassword)
      return setFormError("Konfirmasi kata sandi belum sama.");
    if (isRegister) register.mutate({ name, email, password });
    else login.mutate({ email, password });
  };
  const mutationError = (isRegister ? register.error : login.error)?.message;
  return (
    <main className="local-auth-page">
      <div className="local-auth-orb one" />
      <div className="local-auth-orb two" />
      <section className="local-auth-card">
        <div className="local-auth-top">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <HealthAirLogo />
            </span>
            HealthAir AI
          </Link>
          <Link href="/" className="local-auth-back">
            <ArrowLeft size={14} /> Beranda
          </Link>
        </div>
        <div className="local-auth-intro">
          <span className="local-auth-icon">
            {isRegister ? <Leaf size={20} /> : <LockKeyhole size={20} />}
          </span>
          <span className="eyebrow">
            <span className="eyebrow-dot" /> Akun HealthAir
          </span>
          <h1>
            {isRegister
              ? "Buat akun untuk mulai menjelajah."
              : "Masuk ke ruang udara Anda."}
          </h1>
          <p>
            {isRegister
              ? "Simpan preferensi dan lokasi favorit agar pengalaman HealthAir terasa lebih personal."
              : "Gunakan email dan kata sandi HealthAir Anda untuk melanjutkan."}
          </p>
        </div>
        <form className="local-auth-form" onSubmit={submit}>
          {isRegister && (
            <label>
              <span>Nama</span>
              <div>
                <UserRound size={16} />
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Nama Anda"
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </div>
            </label>
          )}
          <label>
            <span>Email</span>
            <div>
              <Mail size={16} />
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="nama@email.com"
                autoComplete="email"
                required
              />
            </div>
          </label>
          <label>
            <span>Kata sandi</span>
            <div>
              <LockKeyhole size={16} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Minimal 8 karakter"
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                minLength={8}
              />
              <button
                type="button"
                aria-label={
                  showPassword
                    ? "Sembunyikan kata sandi"
                    : "Tampilkan kata sandi"
                }
                onClick={() => setShowPassword(value => !value)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {isRegister && (
            <label>
              <span>Konfirmasi kata sandi</span>
              <div>
                <LockKeyhole size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  placeholder="Ulangi kata sandi"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
            </label>
          )}
          {(formError || mutationError) && (
            <p className="local-auth-error" role="alert">
              {formError || mutationError}
            </p>
          )}
          <button
            className="button button-primary local-auth-submit"
            disabled={pending}
          >
            {pending
              ? "Memproses…"
              : isRegister
                ? "Daftar & mulai"
                : "Masuk ke HealthAir"}{" "}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="local-auth-switch">
          {isRegister ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Masuk" : "Daftar sekarang"}
          </Link>
        </p>
        <p className="local-auth-note">
          Kata sandi Anda terlindungi dan tidak disimpan sebagai teks biasa.
        </p>
      </section>
    </main>
  );
}
