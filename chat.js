import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js"
import { mount } from './spreadsheet.js'
window.addEventListener("error", (e) => {
  console.error(e);
  alert(e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error(e);
  alert(e.reason);
});

let chat

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
    const { messageDiv, ...cleanMsg } = msg;
    return cleanMsg
  });
  localStorage['chatHistory'] = JSON.stringify(cleanHistory)
}

window.chat = chat = new quikchat("#chat", async (instance, message) => {
  const history = chat
    .historyGet()
    .filter(msg => msg.userID != 0) // drop ui-only messages
    .map((msg) => ({
      text: msg.content,
      role: msg.align == "left" ? "model" : "user",
    }));

  // Echo user message
  instance.messageAddNew(marked.parse(message), "You", "right");

  const msgId = chat.messageAddNew("...", "Bot", "left");

  let content = ''
  //chat.setSanitizer(content => marked.parse(content))

  let abort = new AbortController();
  let res = await fetch("./chat_completions", {
    method: "POST",
    signal: abort.signal,
    body: JSON.stringify({
      text: message,
      history,
    }),
  });

  if (res.ok) {
    let stream = events(res, abort.signal);
    for await (let event of stream) {
      if (event.event == "message") {
        const data = JSON.parse(event.data);
        content += data.text
        chat.messageReplaceContent(msgId, marked.parse(content))
      } else if (event.event == "done") {
        saveHistory()
      } else if (event.event == "search_results") {
        /* Skip because the model outputs result itself
        const data = JSON.parse(event.data)
        content = "Found the following audits:<br><ul>"
        for (const audit of data.search_results) {
          content += `<li><a href='${audit.url}'>${audit.full_name}</a></li>`
        }
        content += '</ul>'
        chat.messageReplaceContent(msgId, content)
        */
      } else {
        throw new Error("illegal event type: " + event.type);
      }
    }
  } else {
    console.error("response", res);
    throw new Error("Invalid response: status " + res.status);
  }
});

const textarea = document.getElementsByTagName('textarea')[0]
textarea.focus()
mount(textarea)

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
  addWelcomeMessage()
}
