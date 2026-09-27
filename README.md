# TermoVolt – sajt

Statični sajt za GitHub Pages (besplatno). Četiri jezika: srpski latinica, srpski ćirilica, nemački, engleski.
Kontakt forma šalje upite na vaš e-mail preko besplatnog servisa Web3Forms.
Admin stranica (`admin.html`) služi za dodavanje, izmenu i brisanje projekata sa slikama.

## 1. Postavljanje na GitHub Pages

1. Napravite nalog na https://github.com (ako ga nemate).
2. Kliknite **New repository**, nazovite ga npr. `termovolt`, izaberite **Public** i kliknite **Create repository**.
3. Na stranici repozitorijuma kliknite **uploading an existing file** (ili *Add file → Upload files*),
   prevucite **sve fajlove i foldere** iz ove arhive i kliknite **Commit changes**.
4. Idite na **Settings → Pages**. Pod *Build and deployment* izaberite
   **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)** i kliknite **Save**.
5. Posle 1–2 minuta sajt je na adresi `https://VAŠE-KORISNIČKO-IME.github.io/termovolt/`.

## 2. Kontakt forma (upiti stižu na e-mail)

1. Otvorite https://web3forms.com, upišite e-mail adresu na koju želite da stižu upiti i kliknite **Create Access Key**.
2. Ključ vam stiže na mejl.
3. Na GitHub-u otvorite fajl `config.js`, kliknite olovku (Edit), nalepite ključ umesto
   `UPISITE-VAS-WEB3FORMS-KLJUC`, i tu upišite i telefon, e-mail i područje rada. Kliknite **Commit changes**.

Besplatni paket Web3Forms prima 250 poruka mesečno. Dok ključ nije upisan, forma otvara e-mail program posetioca.

## 3. Admin: token za dodavanje projekata

Admin stranica upisuje slike direktno u vaš repozitorijum, pa joj treba GitHub token:

1. GitHub → klik na profilnu sliku → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Naziv: `termovolt-admin`. Trajanje: npr. 1 godina (kad istekne, napravite novi).
3. **Repository access → Only select repositories →** izaberite `termovolt`.
4. **Permissions → Repository permissions → Contents → Read and write**.
5. Kliknite **Generate token** i kopirajte ga (prikazuje se samo jednom).

Zatim otvorite `https://VAŠE-KORISNIČKO-IME.github.io/termovolt/admin.html`, upišite korisničko ime,
naziv repozitorijuma i token, i prijavite se. Token se čuva samo u tom pretraživaču i nikad ne ide u kod sajta.
Ne delite token ni sa kim.

U adminu:
- **Novi projekat**: naziv (srpski je obavezan), opis, mesto, datum i slike. Slike se automatski smanjuju pre slanja.
- **Postavi kao naslovnu** bira sliku koja se vidi u listi projekata.
- **Izmeni / Obriši** kod svakog objavljenog projekta.
- Posle svake izmene sajt se osveži za 1–2 minuta.

## 4. Izmena tekstova

Svi tekstovi sajta su u `js/i18n.js` (srpski, nemački, engleski). Srpski se piše latinicom,
ćirilica se pravi automatski. Kontakt podaci su u `config.js`.

## 5. Sopstveni domen (nije obavezno)

Ako kupite domen (npr. `termovolt.rs`), upišite ga u **Settings → Pages → Custom domain**
i kod registra domena podesite DNS kako GitHub opisuje na toj stranici.

## Struktura

```
index.html        početna stranica
admin.html        administracija projekata
config.js         kontakt podaci i ključ forme
projects.json     lista projekata (menja je admin)
projects/         slike projekata (puni ih admin)
css/style.css     izgled
js/i18n.js        prevodi
js/main.js        rad sajta
js/admin.js       rad admina
img/              logo i ikonice
```
