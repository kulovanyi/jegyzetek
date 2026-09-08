# 📝 Jegyzetek – PWA alkalmazás

Személyes, mobilbarát feladatkezelő valós idejű szinkronizációval.  
Működik Chrome-ban és mobilon egyaránt, telepíthető PWA-ként.

---

## ✨ Funkciók

- 📂 Témák (kategóriák) kezelése – létrehozás, törlés, szín választás
- 🔲 **Csempés** vagy **Lista nézet** – váltható a fejlécben
- ☑️ Jelölőnégyzetes feladatlista – kipipálva eltűnik az elem
- 🔄 **Valós idejű szinkronizáció** – minden eszközön azonnal frissül
- 📱 **PWA** – mobilon telepíthető (főképernyőre adható)
- 🔒 Biztonságos bejelentkezés (Firebase Authentication)

---

## ⚙️ Telepítés – egyszer kell elvégezni

### 1. Firebase projekt létrehozása

1. Nyisd meg: **https://console.firebase.google.com**
2. Kattints: **„Projekt létrehozása"**
3. Adj nevet (pl. `jegyzetek`), kövess az utasításokat
4. Google Analytics: kihagyható

### 2. Webalkalmazás hozzáadása & konfiguráció

1. A projekt főoldalán kattints a **`</>`** (Web) ikonra
2. Adj nevet (pl. `jegyzetek-web`), majd: **Regisztráció**
3. Megjelenik a `firebaseConfig` objektum – **másold ki**
4. Nyisd meg a `js/firebase-config.js` fájlt
5. Cseréld ki a `"IDE_JON_..."` értékeket a saját adataiddal

### 3. Authentication beállítása

1. Firebase Console → bal menü → **Authentication**
2. Kattints: **„Első lépések"**
3. Fül: **„Sign-in method"**
4. Kattints: **E-mail-cím/jelszó** → engedélyezd → **Mentés**
5. Fül: **„Felhasználók"** → **„Felhasználó hozzáadása"**
6. E-mail mezőbe írd be (a Te választott felhasználónevet Base64-kódolva + `@nj.internal`):

   ```
   Hogyan számítod ki az e-mail mezőt:
   1. Nyisd meg a böngésző konzolt (F12 → Console)
   2. Írd be: btoa("FELHASZNALONEV").replace(/=/g,"") + "@nj.internal"
   3. A kapott értéket add meg Firebase-ben e-mail-ként
   ```

   Jelszó: a saját titkos kódod
7. Kattints: **Mentés**

> 💡 A belépési képernyőn a **Felhasználónév** mezőbe a Te felhasználóneved (nem az e-mail!) kell beírni.  
> Az alkalmazás automatikusan alakítja át a megfelelő formátumra.

### 4. Firestore adatbázis

1. Firebase Console → **Firestore Database**
2. **„Adatbázis létrehozása"** → **„Éles módban"** → régió: `europe-west3`
3. Biztonsági szabályok beállítása (Firestore → **„Szabályok"** fül):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

Kattints: **Közzététel**

### 5. GitHub Pages – közzététel

1. Töltsd fel a kódot a GitHub repódba
2. Repó → **Settings** → **Pages**
3. Branch: `main`, mappa: `/ (root)` → **Save**
4. Néhány perc múlva elérhető:  
   `https://FELHASZNALONEV.github.io/REPO_NEVE`

---

## 📱 PWA telepítése

| Eszköz | Lépések |
|---|---|
| **Android (Chrome)** | Nyisd meg → ⋮ menü → „Hozzáadás a kezdőképernyőhöz" |
| **iOS (Safari)** | Nyisd meg → ⎙ Megosztás → „Hozzáadás a főképernyőre" |
| **Chrome asztali** | Jobb felső sarokban a ⊞ telepítési ikon |

---

## 🗂️ Fájlstruktúra

```
jegyzetek/
├── index.html          # Főoldal (SPA)
├── manifest.json       # PWA konfiguráció
├── service-worker.js   # Offline gyorsítótár
├── css/
│   └── style.css       # Teljes stílus
├── js/
│   ├── app.js          # Alkalmazás logika
│   └── firebase-config.js  # ← ITT add meg a Firebase adatokat!
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

---

## 🔒 Biztonsági megjegyzés

A felhasználónév és jelszó **nem szerepel a kódban**.  
Az adatokat a Firebase Authentication tárolja biztonságosan.  
A Firestore adatokhoz csak bejelentkezett felhasználó férhet hozzá.
