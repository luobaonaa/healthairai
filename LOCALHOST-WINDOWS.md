# Menjalankan HealthAir secara lokal di Windows

HealthAir adalah aplikasi Node.js. Jangan membukanya melalui URL folder Apache MAMP seperti `http://localhost/HealthAir`.

Sebelum dijalankan, impor `database/healthair_local.sql` lewat phpMyAdmin. Script tersebut tidak memakai foreign key agar tetap kompatibel dengan tabel MAMP yang mungkin sudah ada. Lalu salin `.env.local.example` menjadi `.env.local` dan sesuaikan `DATABASE_URL` serta `JWT_SECRET`.

## Jika impor sebelumnya gagal dengan galat #1215

Pilih database `healthair_local` di phpMyAdmin, buka tab **SQL**, lalu jalankan perintah berikut hanya bila tabel `local_accounts` sempat terbentuk sebagian:

```sql
DROP TABLE IF EXISTS `local_accounts`;
```

Setelah itu, buka tab **Import** dan pilih lagi `database/healthair_local.sql` versi terbaru. Script baru menggunakan indeks biasa, bukan foreign key, sehingga tidak bergantung pada struktur tabel `users` yang sudah ada.

Setelah Node.js LTS dan dependensi terpasang, jalankan dari folder `C:\MAMP\htdocs\HealthAir` dengan berkas `start-local-windows.cmd`.

```powershell
cd C:\MAMP\htdocs\HealthAir
.\start-local-windows.cmd
```

Setelah log menampilkan `Server running on http://localhost:3000/`, buka:

```text
http://localhost:3000
```

Tekan `Ctrl+C` di jendela terminal untuk menghentikan server. Pada pemasangan lokal tanpa konfigurasi platform, log OAuth dapat menampilkan peringatan variabel yang tidak tersedia; peringatan tersebut tidak menghalangi halaman utama dan halaman Eksplorasi untuk dimuat.
