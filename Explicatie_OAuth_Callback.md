# Explicatie: Metode de Callback pentru Autentificare (OAuth 2.0)

Când o aplicație de desktop (cum este cea pe care o construim) vrea să se conecteze la Google Drive, ea nu poate cere utilizatorului username-ul și parola direct. În schimb, folosește un protocol numit **OAuth 2.0**.

Acest protocol funcționează astfel:
1.  Aplicația deschide un browser web (Chrome, Edge) cu pagina oficială de logare Google.
2.  Utilizatorul se loghează și își dă acordul.
3.  Google trebuie să trimită înapoi aplicației un "cod" secret pentru a finaliza logarea.

Aici intervine întrebarea: **Cum trimite Google acel cod din browser înapoi în aplicația noastră de desktop?**

Există două metode principale:

## 1. Local Loopback Server (Server Local)
Aceasta este metoda pe care o vom folosi noi, fiind cea mai simplă și sigură pentru PC.

*   **Cum funcționează:**
    *   Aplicația ta pornește temporar un mic server web intern, invizibil, pe propriul tău calculator (de exemplu, la adresa `http://127.0.0.1:5000` sau `http://localhost:5000`).
    *   Îi spunem lui Google: "După ce utilizatorul se loghează, trimite-l (redirect) la adresa `http://localhost:5000/callback`".
    *   Browserul accesează acea adresă.
    *   Aplicația noastră (care ascultă la acea adresă) prinde cererea, ia codul din ea, și apoi poate închide serverul temporar.
*   **Avantaj:** Este foarte compatibilă cu orice sistem de operare (Windows, Mac, Linux) și nu necesită configurări speciale în regiștrii Windows.

## 2. Deep Linking (Custom URI Scheme)
Aceasta este metoda folosită des pe telefoane (mobil), dar merge și pe Desktop.

*   **Cum funcționează:**
    *   Înregistrăm aplicația în Windows să răspundă la un protocol special, de genul `licentaapp://`.
    *   Îi spunem lui Google: "După logare, trimite utilizatorul la adresa `licentaapp://callback`".
    *   Când browserul încearcă să deschidă acel link, Windows recunoaște protocolul `licentaapp://` și deschide automat aplicația noastră, transmițându-i codul.
*   **Dezavantaj:** Este mai complicat de configurat (trebuie modificat regustrul Windows la instalare) și uneori browserul cere permisiunea utilizatorului ("Vrei să deschizi aplicația X?"), ceea ce adaugă un pas în plus.

### Concluzie
Pentru lucrarea de licență, vom folosi **Local Loopback Server**. Este standardul industriei pentru aplicații Desktop de development și testare, fiind robust și ușor de implementat fără a modifica setările sistemului de operare ale utilizatorului.
