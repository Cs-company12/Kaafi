KAAFI HOSPITAL — NIDAAMKA BALLAMAHA (C.S Company)
=================================================

FAYLASHA
  index.html          Bogga dadweynaha (bukaannada ayaa ballansanaya)
  admin.html          Bogga admin-ka (ballamaha realtime + sawirada dhakhaatiirta)
  manifest.json       PWA (public)  ·  admin-manifest.json  PWA (admin)
  sw.js               Service worker (app shell)
  icons/              Astaamaha app-ka (Kaafi logo)

SIDA LOO DAABACO (Netlify)
  1. Fur app.netlify.com/drop
  2. Ku rid zip-kan (ama faylasha oo dhan) — link ayaa la siinayaa
  3. Bukaannada: https://<site>.netlify.app/
     Admin:      https://<site>.netlify.app/admin.html

GALITAANKA ADMIN-KA
  admin.html → Username + Password (waxaa lagu kaydiyay database-ka, bcrypt hash).
  Password-ka kuma jiro faylasha HTML. Is-diiwaangelin (sign-up) admin ma jirto —
  admin cusub waxaa ku dari kara C.S Company oo kaliya (database).

LACAG BIXINTA
  Wadarta = lacagta dhakhtarka + $1 khidmadda ballanta (server-ka ayaa xisaabiya).
  Badhanka "Xaqiiji & Bixi" wuxuu furayaa: *789*736275*WADARTA#

DATABASE (Supabase · tpmsyyhrnciqqcxlfamr)
  kaafi_doctors, kaafi_bookings, kaafi_admins, kaafi_admin_setup
  Storage bucket: kaafi-doctors (sawirada dhakhaatiirta)
  Dhammaan miisaska cusub waxay leeyihiin GRANTs cad oo ugu yar + RLS.
