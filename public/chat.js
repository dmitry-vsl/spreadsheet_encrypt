import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js"
import { mount } from './spreadsheet.js'
import { streamCompletion } from './openai.js'
import { publicKey, decrypt } from './encrypt.js'
window.addEventListener("error", (e) => {
  console.error(e);
  alert(e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error(e);
  alert(e.reason);
});

let chat
let currentSpreadsheets

function addWelcomeMessage() {
  chat.messageAddFull({
    content: "I can help you to securely analyze a spreadsheet. Paste or drop a spreadsheet to continue",
    userString: "Bot",
    align: "left",
    userID: 0, // indicated that it would be excluded from history
  })
}

function saveHistory() {
  // Remove DOM references before saving
  const cleanHistory = chat.historyGetAllCopy().map(msg => {
    const {...cleanMsg } = msg;
    return cleanMsg
  });
  localStorage['chatHistory'] = JSON.stringify(cleanHistory)
}

function onSpreadsheetsAdded(spreadsheets) {
  currentSpreadsheets = spreadsheets
  renderSpreadsheetList()
}

function renderSpreadsheetList() {
  let listEl = document.getElementById('spreadsheet-list')
  if (!listEl) {
    listEl = document.createElement('div')
    listEl.id = 'spreadsheet-list'
    listEl.style.cssText = 'padding: 6px 10px; background: #f0f4f8; border-radius: 6px; margin-bottom: 6px; font-family: ui-sans-serif, system-ui; font-size: 13px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;'
    const inputArea = document.querySelector('.quikchat-input-area')
    inputArea.parentNode.insertBefore(listEl, inputArea)
  }
  listEl.innerHTML = ''
  const fileNames = currentSpreadsheets ? Object.keys(currentSpreadsheets) : []
  if (!fileNames.length) {
    listEl.remove()
    return
  }
  const label = document.createElement('span')
  label.textContent = 'Attached:'
  label.style.cssText = 'font-weight: 600; color: #555;'
  listEl.appendChild(label)
  for (const name of fileNames) {
    const chip = document.createElement('span')
    chip.textContent = name
    chip.style.cssText = 'background: #dce6f0; padding: 2px 8px; border-radius: 4px; color: #333;'
    listEl.appendChild(chip)
  }
}

function parseAndDecrypt(text) {
  return text.replace(/<encrypted>([\s\S]*?)<\/encrypted>/g, (_, str) => {
    if(!/^\d+$/.test(str)) {
      console.error('malformed encrypted value', str)
      throw new Error('malformed encrypted value')
    }
    return decrypt(BigInt(str)).toString()
  });
}

/* TODO remove
console.log(parseAndDecrypt(`<p>Total GDP (billion USD):<br><encrypted>141238182061617681078106244253578972631554812039859952480297182248580457614305739618053493707571377352417496759993125130053007283396359175700564715626696426742784898739127758915407514819536555846017631698423644015547967930511642627893987169222533605004948745186382448886317352167646913508906359456000815784607</encrypted></p>
`))
*/

window.chat = chat = new window.quikchat("#chat", async (instance, message) => {
  const history = chat
    .historyGet()
    .filter(msg => msg.userID != 0) // drop ui-only messages
    .map((msg) => ({
      content: msg.content,
      role: msg.align == "left" ? "assistant" : "user",
    }));

  // Echo user message
  instance.messageAddNew(marked.parse(message), "You", "right");

  const msgId = chat.messageAddNew("...", "Bot", "left");

  // Grab attached spreadsheets and clear them
  const files = currentSpreadsheets
  if (files && Object.keys(files).length) {
    currentSpreadsheets = undefined
    renderSpreadsheetList()
    const userMessage = message
    message = ''
    message += `The value for \`n\` in public key is ${publicKey.n}\n`
    message += `The following columns are encrypted:\n`

    for(let [filename, {sheets}] of Object.entries(files)) {
      for(let [sheet, {encrypted}] of Object.entries(sheets)) {
        message += `Filename: ${filename} Sheet: ${sheet}, Columns: ${[...encrypted]}\n`
      }
    }

    message += userMessage
    console.error('message', message)
  }

  await streamCompletion(
    history, 
    message, 
    (content) => {
      chat.messageReplaceContent(msgId, marked.parse(parseAndDecrypt(content)))
    }, 
    { 
    files: files && Object.values(files).map(f => f.encryptedFile),
    }
  );

  saveHistory();
});

const textarea = document.getElementsByTagName('textarea')[0]
textarea.focus()
const { handleSpreadsheets } = mount(textarea, {
  onSpreadsheetsReady: onSpreadsheetsAdded,
})

const chatHistory = localStorage.chatHistory
if(chatHistory) {
  chat.historyRestoreAll(JSON.parse(chatHistory))
} else {
  addWelcomeMessage()
}

//chat.setSanitizer(quikchat.sanitizers.escapeHTML)

const clearButton = document.createElement('button')
clearButton.innerHTML = 'Clear chat'
clearButton.classList.toggle('quikchat-input-send-btn')
clearButton.classList.toggle('clear-btn')
document.querySelector('.quikchat-input-area').insertBefore(
  clearButton,
  document.querySelector('.quikchat-input-send-btn'),
)
clearButton.onclick = function() {
  chat.historyClear()
  delete localStorage.chatHistory
  currentSpreadsheets = undefined
  renderSpreadsheetList()
  addWelcomeMessage()
}

const importButton = document.createElement('button')
importButton.innerHTML = 'Import spreadsheets'
importButton.classList.toggle('quikchat-input-send-btn')
document.querySelector('.quikchat-input-area').insertBefore(
  importButton,
  document.querySelector('.quikchat-input-send-btn'),
)
importButton.onclick = function() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = '.csv,.xlsx,.xls,.ods,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet,text/tab-separated-values'
  input.onchange = () => {
    if (input.files.length) handleSpreadsheets(input.files)
  }
  input.click()
}
