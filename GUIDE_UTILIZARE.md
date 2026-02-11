# Ghid de Utilizare și Testare - Aplicație Licență

Acest fișier explică cum să pornești aplicația și pașii pentru a testa funcționalitățile implementate.

## 1. Pornirea Aplicației

Pentru a rula aplicația în modul de dezvoltare (unde poți vedea modificările în timp real), ai nevoie de două terminale (sau unul singur dacă scriptul le rulează pe ambele, dar recomand două pentru claritate):

### Terminal 1 (O singură comandă pentru tot)
Aplicația este configurată să pornească totul cu o singură comandă:
```bash
npm run dev
```
Aceasta va porni:
1.  Serverul Vite (Frontend React)
2.  Procesul Electron (Backend)

Dacă totul este ok, se va deschide automat o fereastră cu aplicația.

## 2. Testarea Funcționalităților

### A. Autentificare (Login/Register)
1.  **Register**:
    - În ecranul de Login, apasă pe "Register".
    - Introdu un username și o parolă + un indiciu (Hint).
    - Apasă "Register". Dacă e succes, te va loga automat sau te va trimite la Login.
2.  **Login**:
    - Folosește contul creat.
    - Testează și butonul "Continue as Guest" pentru a intra fără cont (unele funcții de salvare pot fi limitate).

### B. Dashboard & Streaming
1.  **Conectare Youtube**:
    - În Dashboard, lipește un link de Youtube (ex: un video scurt sau un live stream).
    - Apasă "Connect". Video-ul trebuie să apară și să poată fi redat.

### C. Înregistrare (Recording)
1.  **Start**:
    - Apasă butonul roșu **"Start Recording"**.
    - Selectează sursa (Ecranul întreg sau o fereastră specifică).
    - Înregistrarea a început. Timer-ul rulează.
2.  **Sync Logic (Sincronizare)**:
    - În timp ce înregistrezi, pune pauză la video-ul de pe Youtube.
    - **Așteptare**: Înregistrarea ar trebui să intre automat în PAUZĂ (butonul de pauză devine "Resume").
    - Dă play din nou la video -> Înregistrarea nu pornește singură (pentru siguranță), sau poți da tu Resume.
    - *Nota*: Logica curentă pune pauză la Rec când pui pauză la Video. Testează acest comportament.
3.  **Stop**:
    - Apasă "Stop Rec".
    - **Nou**: Ar trebui să apară o fereastră (Modal) cu previzualizarea filmării și opțiuni:
        - **Delete**: Șterge fișierul temporar.
        - **Save**: Salvează definitiv (Local, SQLite sau Drive).

### D. Google Drive (Settings)
1.  Mergi la pagina **Settings** din meniul stânga.
2.  Apasă "Connect Drive".
3.  Se va deschide browserul tău. Loghează-te cu contul Google.
4.  După succes, în aplicație va apărea statusul "Connected".
5.  Acum, când salvezi o înregistrare, dacă alegi "Google Drive", ea se va încărca în cloud.

## Comenzi Utile (Terminal)
- `npm install`: Instalează dependențele (dacă adaugi librării noi).
- `git status`: Verifică modificările făcute.
