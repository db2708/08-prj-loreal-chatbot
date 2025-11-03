/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Splash overlay elements (dismiss before using chat)
const splash = document.getElementById("splash");
const enterBtn = document.getElementById("enterBtn");

function hideSplash() {
  if (!splash) return;
  splash.classList.add("hidden");
  // remove from DOM after transition so it doesn't block tab/focus
  setTimeout(() => {
    if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    // focus the chat input after splash removed
    if (userInput) userInput.focus();
  }, 600);
}

if (splash) {
  // Only the Enter button dismisses the splash. Do NOT dismiss on overlay click or auto-dismiss.
  enterBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    hideSplash();
  });
}

// Cloudflare Worker URL (deployed)
const workerUrl = "https://loreal-worker.dombish.workers.dev/";

// System prompt: instruct the model to behave as L'Oréal Specialist
const systemMessage = {
  role: "system",
  content: `Act as a L’Oréal Specialist who is highly knowledgeable about L’Oréal’s entire product range—including makeup, skincare, haircare, and fragrances. Your primary goal is to provide expert, personalized beauty routines and product recommendations tailored to each user's needs, concerns, or preferences, strictly using L’Oréal products. Always ensure your answers are accurate, informative, and up-to-date with L’Oréal’s offerings.

Politely and firmly refuse to answer any questions unrelated to L’Oréal products, routines, recommendations, or beauty-related topics. Direct users back to relevant L’Oréal or beauty topics if they inquire about something else.

For each user request:
- Gather any relevant information about the user’s preferences, skin/hair type, goals, and routines if not already provided.
- Clearly reason about the user’s needs and how different products or routines apply before making a recommendation.
- Only after reasoning, provide your specific product and/or routine recommendations.
- If the request is not about L’Oréal or beauty, respond courteously with a brief, polite refusal and guide the conversation back to beauty.

Persist until you have all needed information; reason step-by-step internally before finalizing your answer.

Output Format: Respond in friendly, informative, medium-length paragraphs. Use clear and polite language. If suggesting multiple products or steps, use bullet points or numbered lists for clarity.`
};

// Guidance to enforce concise replies (helps prevent server-side truncation)
systemMessage.content += `\n\nKeep responses concise and focused: aim for roughly 2–4 short sentences or a brief bulleted list. Limit outputs to about 250 tokens and avoid overly verbose explanations unless the user explicitly asks for more detail.`;

// Conversation history (starts with system message)
const messages = [systemMessage];

// Set initial message (visible to user)
chatWindow.innerHTML =
  '<div class="msg ai">👋 Hello! I am a L\'Oréal Specialist — tell me about your skin/hair concerns and I can recommend products and routines.</div>';

/* helper to append messages to the chat window */
function addMessage(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  // show user message and add to history
  addMessage("user", message);
  messages.push({ role: "user", content: message });
  userInput.value = "";
  userInput.focus();

  // show a temporary loading message
  addMessage("ai", "Thinking...");

  try {
    const body = { messages };

    const resp = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`Worker error: ${resp.status}`);
    }

    const data = await resp.json();

    // remove the last "Thinking..." message if present
    const aiMsgs = chatWindow.querySelectorAll(".msg.ai");
    const lastAi = aiMsgs[aiMsgs.length - 1];
    if (lastAi && lastAi.textContent === "Thinking...") lastAi.remove();

    const assistantText =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "No response from API.";

    // append assistant message to history and UI
    messages.push({ role: "assistant", content: assistantText });
    addMessage("ai", assistantText);
  } catch (err) {
    // remove loading
    const aiMsgs = chatWindow.querySelectorAll(".msg.ai");
    const lastAi = aiMsgs[aiMsgs.length - 1];
    if (lastAi && lastAi.textContent === "Thinking...") lastAi.remove();

    addMessage("ai", "Sorry — something went wrong. Please try again later.");
    console.error("Chat error:", err);
  }
});
