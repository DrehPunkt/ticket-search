# Ticket-Nummer-Suche (Thunderbird-Add-on)

Erkennt eine Ticket-Nummer im Betreff einer E-Mail (z. B.
`Ticket#2026091300079000478`) und zeigt dafür ein Icon in der
Nachrichten-Ansicht. Ein Klick öffnet eine Ergebnisliste mit allen
E-Mails, die dieselbe Ticket-Nummer im Betreff tragen.

## Installation (temporär, zum Testen)

1. In Thunderbird `about:debugging#/runtime/this-firefox` öffnen.
2. „Temporäres Add-on laden…" klicken.
3. Die Datei `ticket-nummer-suche.xpi` auswählen.
4. Das Add-on bleibt geladen, bis Thunderbird neu gestartet wird.

## Installation (dauerhaft)

Für eine dauerhafte, neustart-feste Installation muss die `.xpi` bei
Mozilla (addons.thunderbird.net) signiert werden, oder Thunderbird
läuft im Entwickler-/ESR-Modus mit deaktivierter Signaturprüfung
(`xpinstall.signatures.required` auf `false` in `about:config`).

## Nutzung

- Eine E-Mail öffnen, deren Betreff eine Ticket-Nummer enthält.
- Passt der Betreff auf das Muster, wird das Icon in der
  Nachrichten-Toolbar aktiv; der Tooltip zeigt die erkannte Nummer.
  Ein Badge auf dem Icon zeigt zusätzlich, wie viele Nachrichten im
  **selben Ordner** (nicht rekursiv) auf diese Ticket-Nummer passen.
  Ob die Nummer zusätzlich als Text neben dem Icon erscheint, hängt vom
  Anzeigestil der Toolbar ab (siehe „Bekannte Einschränkungen").
- Klick auf das Icon setzt den **Schnellfilter** der Nachrichtenliste
  im aktuellen Ordner auf die Ticket-Nummer, mit den Kriterien „Von",
  „An" und „Betreff" aktiviert, und bringt den Nachrichten-Tab in den
  Vordergrund.

## Bekannte Einschränkungen

- Der sichtbare Text neben dem Icon (nicht der Tooltip) wird nur
  angezeigt, wenn die Toolbar auf „Symbole und Text" statt „Nur
  Symbole" eingestellt ist: Rechtsklick auf die Nachrichten-Toolbar →
  „Anpassen…" → Anzeigestil unten im Anpassen-Fenster umstellen.
- Der Schnellfilter durchsucht immer nur den **aktuell angezeigten
  Ordner** (bzw. dessen Unterordner, je nach Schnellfilter-Einstellung),
  nicht automatisch alle Konten.
- **`setQuickFilter` setzt beim Aufruf immer den kompletten Zustand der
  Schnellfilter-Leiste.** Andere zuvor manuell gesetzte Kriterien
  (Anhang, Markiert, Tags, Ungelesen) und der Pin-Status („Beim
  Wechseln des Ordners Filterkriterien aktiv lassen") werden durch
  einen Klick auf das Icon zurückgesetzt bzw. deaktiviert. Die
  WebExtension-API bietet keine Möglichkeit, den vorherigen Zustand
  auszulesen oder gezielt wiederherzustellen – das ist eine Grenze der
  Thunderbird-API, kein Fehler des Add-ons.

## Konfiguration

Über „Add-ons verwalten → Ticket-Nummer-Suche → Einstellungen" lässt
sich das RegEx-Muster zur Erkennung der Ticket-Nummer anpassen. Ein
Testfeld zeigt live, ob ein Beispiel-Betreff auf das Muster passt.

Standardmuster: `Ticket#\d{5,}` (also „Ticket#" gefolgt von
mindestens 5 Ziffern).

## Dateien

| Datei | Zweck |
|---|---|
| `manifest.json` | Add-on-Metadaten, Berechtigungen, Toolbar-Button |
| `background.js` | Erkennung im Betreff, Button-Steuerung, Klick-Handler |
| `options.html` / `options.js` | Einstellungsseite für das RegEx-Muster |
| `icons/` | Icon des Toolbar-Buttons (SVG, „Ticket"-Icon von [Phosphor Icons](https://phosphoricons.com/?q=ticket)) |

## Voraussetzungen

Thunderbird 128 oder neuer (Manifest V3).
