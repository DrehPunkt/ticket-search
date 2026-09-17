/**
 * Ticket-Nummer-Suche
 *
 * Erkennt im Betreff einer angezeigten Nachricht ein Muster wie
 *   Ticket#2026091300079000478
 * und aktiviert dafür das messageDisplayAction-Icon in der
 * Nachrichten-Ansicht. Zusätzlich zeigt ein Badge auf dem Icon, wie
 * viele Nachrichten im selben Ordner auf diese Ticket-Nummer passen.
 * Ein Klick auf das Icon setzt den Schnellfilter der Nachrichtenliste
 * auf diese Ticket-Nummer, mit fest aktivierten Kriterien "Von", "An"
 * und "Betreff". Andere zuvor gesetzte Schnellfilter-Einstellungen
 * (Anhang, Markiert, Tags, Ungelesen, Pin-Status) werden dabei
 * zurückgesetzt – die Thunderbird-API bietet keine Möglichkeit, den
 * vorherigen Zustand auszulesen oder gezielt wiederherzustellen.
 *
 * Das RegEx-Muster ist über die Add-on-Einstellungen (options.html)
 * konfigurierbar und wird in storage.local unter dem Schlüssel
 * "ticketPattern" abgelegt.
 *
 * Zu Debug-Zwecken wird an allen wichtigen Stellen in die Konsole
 * geloggt (sichtbar über about:debugging → "Untersuchen" beim Add-on).
 */

const LOG_PREFIX = "[ticketsearch]";

console.log(LOG_PREFIX, "Hintergrundskript geladen:", new Date().toISOString());

// "Ticket#" gefolgt von mindestens 5 Ziffern.
const DEFAULT_PATTERN = "Ticket#\\d{5,}";

// tabId -> { ticket, folderId } der aktuell angezeigten Nachricht
const ticketByTab = new Map();

// Aktuell aktives RegExp-Objekt, wird beim Start und bei Änderungen geladen.
let ticketRegExp = new RegExp(DEFAULT_PATTERN, "i");

function buildRegExp(source) {
  try {
    return new RegExp(source, "i");
  } catch (e) {
    console.error(LOG_PREFIX, `ungültiges RegEx "${source}" – verwende Standardmuster.`, e);
    return new RegExp(DEFAULT_PATTERN, "i");
  }
}

async function loadPattern() {
  const stored = await messenger.storage.local.get("ticketPattern");
  const source = stored.ticketPattern || DEFAULT_PATTERN;
  ticketRegExp = buildRegExp(source);
  console.log(LOG_PREFIX, "aktives RegEx-Muster:", ticketRegExp.source);
}

// Beim Start laden …
loadPattern();

// … und neu laden, sobald die Einstellungen geändert werden.
messenger.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.ticketPattern) {
    ticketRegExp = buildRegExp(changes.ticketPattern.newValue || DEFAULT_PATTERN);
    console.log(LOG_PREFIX, "RegEx-Muster geändert auf:", ticketRegExp.source);
  }
});

function extractTicketNumber(subject) {
  if (!subject) return null;
  const match = subject.match(ticketRegExp);
  return match ? match[0] : null;
}

// Sucht alle Nachrichten im angegebenen Ordner (nicht rekursiv, keine
// Unterordner), deren Betreff die Ticket-Nummer enthält. Liefert die
// vollständige Liste der MessageHeader (für Anzahl UND Auswahl).
async function findMatchesInFolder(ticket, folderId) {
  if (!folderId) {
    console.warn(LOG_PREFIX, "findMatchesInFolder: keine folderId vorhanden, überspringe Suche.");
    return null;
  }

  console.log(LOG_PREFIX, `findMatchesInFolder: Suche "${ticket}" in Ordner ${folderId} …`);

  try {
    let page = await messenger.messages.query({
      subject: ticket,
      folderId,
      autoPaginationTimeout: 0
    });
    console.log(LOG_PREFIX, "messages.query erste Seite:", page);

    let messages = page.messages.slice();
    while (page.id) {
      page = await messenger.messages.continueList(page.id);
      console.log(LOG_PREFIX, "messages.query weitere Seite:", page);
      messages = messages.concat(page.messages);
    }
    console.log(LOG_PREFIX, `${messages.length} Treffer für "${ticket}" in Ordner ${folderId} gefunden.`);
    return messages;
  } catch (e) {
    console.error(LOG_PREFIX, "Fehler bei der Suche im Ordner:", e);
    return null;
  }
}

// message: die MessageHeader mit erkannter Ticket-Nummer, oder null
async function updateActionForTab(tabId, message) {
  const ticket = message ? extractTicketNumber(message.subject) : null;
  console.log(LOG_PREFIX, "updateActionForTab", {
    tabId,
    subject: message?.subject,
    erkannteTicketNummer: ticket
  });

  if (ticket) {
    // Hinweis: MessageHeader hat kein "folderId" – das Feld heißt
    // "folder" (ein MailFolder-Objekt), dessen "id"-Eigenschaft
    // (seit TB 121) die MailFolderId liefert.
    const folderId = message.folder?.id;
    ticketByTab.set(tabId, { ticket, folderId });

    try {
      await messenger.messageDisplayAction.enable(tabId);
      await messenger.messageDisplayAction.setIcon({
        tabId,
        path: { 16: "icons/ticket-active-16.svg", 32: "icons/ticket-active-32.svg" }
      });
      await messenger.messageDisplayAction.setLabel({ tabId, label: ticket });
      await messenger.messageDisplayAction.setTitle({
        tabId,
        title: `Alle E-Mails zu ${ticket} suchen`
      });
      console.log(LOG_PREFIX, `Button für Tab ${tabId} aktiviert, Ticket: ${ticket}`);

      // Trefferanzahl im selben Ordner als Badge anzeigen.
      console.log(LOG_PREFIX, "folder der angezeigten Nachricht:", message.folder);
      const matches = await findMatchesInFolder(ticket, folderId);
      const count = matches === null ? null : matches.length;
      console.log(LOG_PREFIX, `ermittelte Trefferzahl für "${ticket}":`, count);

      const badgeText = count === null ? "" : count > 999 ? "999+" : String(count);
      await messenger.messageDisplayAction.setBadgeBackgroundColor({ tabId, color: "#2563eb" });
      await messenger.messageDisplayAction.setBadgeText({ tabId, text: badgeText });
      console.log(LOG_PREFIX, `Badge-Text gesetzt auf "${badgeText}" für Tab ${tabId}.`);
    } catch (e) {
      console.error(LOG_PREFIX, "Fehler beim Aktualisieren von Icon/Label/Badge:", e);
    }
  } else {
    ticketByTab.delete(tabId);
    await messenger.messageDisplayAction.disable(tabId);
    await messenger.messageDisplayAction.setIcon({
      tabId,
      path: { 16: "icons/ticket-inactive-16.svg", 32: "icons/ticket-inactive-32.svg" }
    });
    await messenger.messageDisplayAction.setLabel({ tabId, label: "" });
    await messenger.messageDisplayAction.setBadgeText({ tabId, text: "" });
    await messenger.messageDisplayAction.setTitle({
      tabId,
      title: "Keine Ticket-Nummer im Betreff gefunden"
    });
    console.log(LOG_PREFIX, `Button für Tab ${tabId} deaktiviert (keine Ticket-Nummer im Betreff).`);
  }
}

// Wird ausgelöst, sobald in einem Tab eine oder mehrere Nachrichten
// angezeigt werden (3-Pane-Ansicht, eigener Tab oder eigenes Fenster).
// Hinweis: "onMessageDisplayed" (Singular) gibt es in Manifest V3 nicht
// mehr – nur noch "onMessagesDisplayed" (Plural), auch wenn nur eine
// einzelne Nachricht angezeigt wird.
messenger.messageDisplay.onMessagesDisplayed.addListener(async (tab, messageList) => {
  // Hinweis: In Manifest V3 liefert dieses Event eine MessageList
  // (Objekt mit .messages und .id), keinen rohen Array mehr.
  const messages = messageList.messages;
  console.log(
    LOG_PREFIX,
    "onMessagesDisplayed",
    { tabId: tab.id, anzahlNachrichten: messages.length, betreffe: messages.map((m) => m.subject) }
  );
  const withTicket = messages.find((m) => extractTicketNumber(m.subject));
  await updateActionForTab(tab.id, withTicket || null);
});

// Aufräumen, wenn der Tab geschlossen wird.
messenger.tabs.onRemoved.addListener((tabId) => {
  ticketByTab.delete(tabId);
});

// Findet den passenden Haupt-Nachrichten-Tab (3-Pane-Ansicht), in dem
// die Treffer ausgewählt werden sollen: bevorzugt im selben Fenster wie
// die gerade angezeigte Nachricht, sonst irgendein offener Nachrichten-Tab.
async function findMailTab(sourceTab) {
  let tabs = await messenger.mailTabs.query({ windowId: sourceTab.windowId });
  console.log(LOG_PREFIX, `mailTabs.query im selben Fenster (${sourceTab.windowId}):`, tabs);
  if (tabs.length > 0) return tabs[0];

  tabs = await messenger.mailTabs.query({});
  console.log(LOG_PREFIX, "mailTabs.query über alle Fenster:", tabs);
  return tabs.length > 0 ? tabs[0] : null;
}

// Klick auf das Icon: Schnellfilter auf die erkannte Ticket-Nummer
// setzen, mit fest aktivierten Kriterien "Von" (author), "An"
// (recipients) und "Betreff" (subject). Hinweis: setQuickFilter setzt
// immer den kompletten Zustand der Schnellfilter-Leiste – andere,
// zuvor gesetzte Kriterien (Anhang, Markiert, Tags, Ungelesen) sowie
// der Pin-Status werden dabei zurückgesetzt. Es gibt keine
// WebExtension-API, um den vorherigen Zustand auszulesen oder gezielt
// wiederherzustellen (siehe README, Abschnitt "Bekannte
// Einschränkungen").
messenger.messageDisplayAction.onClicked.addListener(async (tab) => {
  console.log(LOG_PREFIX, "Icon geklickt, tabId =", tab.id);

  const entry = ticketByTab.get(tab.id);
  console.log(LOG_PREFIX, "gespeicherter Eintrag für diesen Tab:", entry);

  if (!entry) {
    console.warn(LOG_PREFIX, "kein Klick-Effekt: keine Ticket-Nummer für diesen Tab bekannt.");
    return;
  }

  const { ticket } = entry;

  const mailTab = await findMailTab(tab);
  console.log(LOG_PREFIX, "verwendeter Mail-Tab:", mailTab);

  if (!mailTab) {
    console.warn(LOG_PREFIX, "kein Klick-Effekt: kein Nachrichten-Tab (3-Pane) gefunden.");
    return;
  }

  try {
    console.log(LOG_PREFIX, `setQuickFilter auf Tab ${mailTab.id} mit Text "${ticket}" …`);
    await messenger.mailTabs.setQuickFilter(mailTab.id, {
      text: { text: ticket, author: true, recipients: true, subject: true },
      show: true
    });
    console.log(LOG_PREFIX, "setQuickFilter erfolgreich ausgeführt.");

    await messenger.windows.update(mailTab.windowId, { focused: true });
    await messenger.tabs.update(mailTab.id, { active: true });
    console.log(LOG_PREFIX, "Nachrichten-Tab in den Vordergrund geholt.");
  } catch (e) {
    console.error(LOG_PREFIX, "Fehler beim Setzen des Schnellfilters:", e);
  }
});
