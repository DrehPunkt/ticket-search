const DEFAULT_PATTERN = "Ticket#\\d{5,}";

const patternInput = document.getElementById("pattern");
const patternError = document.getElementById("pattern-error");
const testInput = document.getElementById("test-subject");
const testResult = document.getElementById("test-result");
const saveButton = document.getElementById("save");
const resetButton = document.getElementById("reset");
const statusEl = document.getElementById("status");

function validate(source) {
  try {
    return { regexp: new RegExp(source, "i"), error: null };
  } catch (e) {
    return { regexp: null, error: e.message };
  }
}

function refresh() {
  const source = patternInput.value.trim();
  const { regexp, error } = validate(source);

  if (!source) {
    patternInput.classList.remove("invalid");
    patternError.textContent = "";
    saveButton.disabled = true;
  } else if (error) {
    patternInput.classList.add("invalid");
    patternError.textContent = `Ungültiger regulärer Ausdruck: ${error}`;
    saveButton.disabled = true;
  } else {
    patternInput.classList.remove("invalid");
    patternError.textContent = "";
    saveButton.disabled = false;
  }

  // Test-Betreff live gegen das Muster prüfen
  const subject = testInput.value;
  if (!subject || !regexp) {
    testResult.textContent = "";
    testResult.className = "";
  } else {
    const match = subject.match(regexp);
    if (match) {
      testResult.textContent = `Treffer: „${match[0]}“`;
      testResult.className = "match-yes";
    } else {
      testResult.textContent = "Kein Treffer in diesem Betreff.";
      testResult.className = "match-no";
    }
  }

  statusEl.textContent = "";
}

async function load() {
  const stored = await messenger.storage.local.get("ticketPattern");
  patternInput.value = stored.ticketPattern || DEFAULT_PATTERN;
  refresh();
}

async function save() {
  const source = patternInput.value.trim();
  const { error } = validate(source);
  if (!source || error) return;

  await messenger.storage.local.set({ ticketPattern: source });
  statusEl.textContent = "Gespeichert.";
  setTimeout(() => (statusEl.textContent = ""), 2000);
}

patternInput.addEventListener("input", refresh);
testInput.addEventListener("input", refresh);
saveButton.addEventListener("click", save);
resetButton.addEventListener("click", () => {
  patternInput.value = DEFAULT_PATTERN;
  refresh();
  save();
});

load();
