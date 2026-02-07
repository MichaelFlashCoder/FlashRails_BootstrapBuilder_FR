const FRONTEND_VERSION = "2026.01.10-radio-fix.14";
//const configuredBaseUrl = "http://127.0.0.1:64770";
const configuredBaseUrl = "https://fl-3b9716472cc04227b52a87c3f1044ebe.ecs.eu-west-2.on.aws";

const baseOrigin = typeof window !== "undefined" && window.location ? window.location.origin : "";
const defaultBaseUrl = configuredBaseUrl || (typeof baseOrigin === "string" && baseOrigin.startsWith("http") ? baseOrigin : "");
const browserCrypto = typeof window !== "undefined" ? window.crypto : undefined;
const randomSessionId = browserCrypto && typeof browserCrypto.randomUUID === "function" ? browserCrypto.randomUUID() : `session-${Date.now()}`;

function generateRandomId(prefix) {
  const randomPart =
    browserCrypto && typeof browserCrypto.randomUUID === "function"
      ? browserCrypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomPart}`;
}

const state = {
  baseUrl: defaultBaseUrl,
  tenantId: generateRandomId("tenant"),
  formId: generateRandomId("form"),
  formName: "Contact Page",
  sessionId: randomSessionId,
  previewModel: null,
  chatHistory: [],
  chatModel: "offline",
  apiVersion: null,
  lastTools: []
};

const elements = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  tenantId: document.getElementById("tenantId"),
  formId: document.getElementById("formId"),
  formName: document.getElementById("formName"),
  createFormBtn: document.getElementById("createFormBtn"),
  loadPreviewBtn: document.getElementById("loadPreviewBtn"),
  refreshPreviewBtn: document.getElementById("refreshPreviewBtn"),
  capturePreviewBtn: document.getElementById("capturePreviewBtn"),
  connectionFeedback: document.getElementById("connectionFeedback"),
  connectionStatus: document.getElementById("connectionStatus"),
  sessionId: document.getElementById("sessionId"),
  frontendVersion: document.getElementById("frontendVersion"),
  apiVersion: document.getElementById("apiVersion"),
  chatModelBadge: document.getElementById("chatModelBadge"),
  chatLog: document.getElementById("chatLog"),
  chatForm: document.getElementById("chatForm"),
  chatMessage: document.getElementById("chatMessage"),
  chatHint: document.getElementById("chatHint"),
  sendMessageBtn: document.getElementById("sendMessageBtn"),
  chatSpinner: document.getElementById("chatSpinner"),
  chatError: document.getElementById("chatError"),
  clearChatBtn: document.getElementById("clearChatBtn"),
  metadataPanel: document.getElementById("metadataPanel"),
  validationPanel: document.getElementById("validationPanel"),
  validationMessages: document.getElementById("validationMessages"),
  previewContainer: document.getElementById("previewContainer"),
  previewStatus: document.getElementById("previewStatus")
};

class ApiClient {
  constructor(stateRef) {
    this.state = stateRef;
  }

  get baseUrl() {
    const trimmed = (this.state.baseUrl || "").trim();
    if (!trimmed) {
      return "";
    }
    return trimmed.replace(/\/+$/, "");
  }

  async request(path, options = {}) {
    const target = `${this.baseUrl}${path}`;
    const response = await fetch(target, {
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const payload = await response.json();
        if (payload && payload.message) {
          message = payload.message;
        } else if (payload && payload.error) {
          message = payload.error;
        }
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  createForm(payload) {
    return this.request("/api/forms", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  getPreview(tenantId, formId) {
    return this.request(`/api/forms/${encodeURIComponent(tenantId)}/${encodeURIComponent(formId)}/preview`, {
      method: "GET"
    });
  }

  sendChat(payload) {
    return this.request("/api/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  getChatOpenApi() {
    return this.request("/api/chat/openapi", {
      method: "GET"
    });
  }
}

const apiClient = new ApiClient(state);

function init() {
  elements.apiBaseUrl.value = state.baseUrl;
  elements.tenantId.value = state.tenantId;
  elements.formId.value = state.formId;
  elements.formName.value = state.formName;
  elements.sessionId.textContent = state.sessionId;
  elements.frontendVersion.textContent = FRONTEND_VERSION;
  updateChatHint();
  updateChatModelBadge();
  renderChatLog();
  renderPreview(null);
  setPreviewStatus("Preview not loaded.", "text-muted");
  refreshApiVersion();

  elements.apiBaseUrl.addEventListener("input", (event) => {
    state.baseUrl = normalizeBaseUrl(event.target.value);
    setConnectionFeedback(`Using API: ${state.baseUrl || "current origin"}`);
    refreshApiVersion();
  });

  elements.tenantId.addEventListener("input", (event) => {
    state.tenantId = event.target.value.trim();
    updateChatHint();
    updateSendButtonState();
  });

  elements.formId.addEventListener("input", (event) => {
    state.formId = event.target.value.trim();
    updateChatHint();
    updateSendButtonState();
  });

  elements.formName.addEventListener("input", (event) => {
    state.formName = event.target.value.trim();
    updateChatHint();
  });

  elements.createFormBtn.addEventListener("click", handleCreateForm);
  elements.loadPreviewBtn.addEventListener("click", () => loadPreview(true));
  elements.refreshPreviewBtn.addEventListener("click", () => loadPreview(true));
  elements.chatForm.addEventListener("submit", handleChatSubmit);
  elements.chatMessage.addEventListener("input", updateSendButtonState);
  elements.clearChatBtn.addEventListener("click", clearChat);
  elements.capturePreviewBtn.addEventListener("click", handleCapturePreview);
}

function normalizeBaseUrl(url) {
  if (!url) {
    return "";
  }
  return url.replace(/\/+$/, "");
}

function setConnectionStatus(message, variant = "text-success") {
  elements.connectionStatus.textContent = message;
  elements.connectionStatus.className = `fw-semibold small ${variant}`;
}

function setConnectionFeedback(message) {
  elements.connectionFeedback.textContent = message;
}

function setPreviewStatus(message, variant = "text-muted") {
  elements.previewStatus.textContent = message;
  elements.previewStatus.className = `small ${variant}`;
}

function updateChatModelBadge() {
  elements.chatModelBadge.textContent = state.chatModel || "model";
}

function updateChatHint() {
  if (!state.tenantId) {
    elements.chatHint.textContent = "Tenant and form selection is required before sending a message.";
    return;
  }

  if (!state.formId) {
    elements.chatHint.textContent = `Working in tenant "${state.tenantId}". Provide a form ID or ask the copilot to create one.`;
    return;
  }

  elements.chatHint.textContent = `Chatting against ${state.tenantId}/${state.formId}. Preview refreshes after each update.`;
}

function updateSendButtonState() {
  const hasTenant = Boolean(state.tenantId);
  const messageReady = Boolean(elements.chatMessage.value.trim());
  elements.sendMessageBtn.disabled = !(hasTenant && messageReady);
}

async function refreshApiVersion() {
  const hasBase = Boolean(state.baseUrl && state.baseUrl.trim());
  if (!hasBase) {
    state.apiVersion = null;
    elements.apiVersion.textContent = "—";
    return;
  }

  elements.apiVersion.textContent = "…";
  try {
    const document = await apiClient.getChatOpenApi();
    const version = document?.info?.version || "unknown";
    state.apiVersion = version;
    elements.apiVersion.textContent = version;
  } catch (error) {
    state.apiVersion = null;
    elements.apiVersion.textContent = "error";
    setConnectionFeedback(`API version check failed: ${error.message}`);
  }
}

async function handleCreateForm() {
  const tenantId = state.tenantId.trim();
  const formName = state.formName.trim();
  const formId = state.formId.trim();

  if (!tenantId || !formName) {
    setConnectionStatus("Tenant ID and page name are required to create a form.", "text-danger");
    return;
  }

  setConnectionStatus("Creating form...", "text-muted");
  try {
    const payload = { tenantId, formName };
    if (formId) {
      payload.formId = formId;
    }
    const document = await apiClient.createForm(payload);
    const metadata = document.metadata;
    state.tenantId = metadata.tenantId;
    state.formId = metadata.formId;
    state.formName = metadata.formName;
    elements.tenantId.value = state.tenantId;
    elements.formId.value = state.formId;
    elements.formName.value = state.formName;
    updateChatHint();
    updateSendButtonState();
    setConnectionStatus(`Form "${metadata.formId}" ready (version ${metadata.version}).`, "text-success");
    setConnectionFeedback(`Last save at ${formatDate(metadata.updatedUtc)}.`);
    await loadPreview(false);
  } catch (error) {
    setConnectionStatus(`Create failed: ${error.message}`, "text-danger");
  }
}

async function loadPreview(showErrors) {
  const tenantId = state.tenantId.trim();
  const formId = state.formId.trim();

  if (!tenantId || !formId) {
    if (showErrors) {
      setPreviewStatus("Provide tenant and form IDs before loading the preview.", "text-warning");
    }
    return;
  }

  setPreviewStatus("Loading preview...", "text-muted");
  try {
    const preview = await apiClient.getPreview(tenantId, formId);
    state.previewModel = preview;
    renderPreview(preview);
    setPreviewStatus(`Preview refreshed at ${formatTime(new Date())}`, "text-success");
  } catch (error) {
    state.previewModel = null;
    renderPreview(null);
    setPreviewStatus(`Preview failed: ${error.message}`, "text-danger");
  }
}

function clearChat() {
  state.chatHistory = [];
  renderChatLog();
  hideChatError();
}

function addChatMessage(role, content, extra = {}) {
  state.chatHistory.push({
    role,
    content,
    tools: extra.tools || [],
    timestamp: new Date(),
    model: extra.model || null
  });
  renderChatLog();
}

function renderChatLog() {
  elements.chatLog.innerHTML = "";
  if (!state.chatHistory.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "chat-message";
    placeholder.innerHTML =
      '<div class="chat-message__role">Assistant</div><div class="text-muted">Start chatting to see how the copilot uses the backend tools.</div>';
    elements.chatLog.appendChild(placeholder);
    return;
  }

  state.chatHistory.forEach((message) => {
    const wrapper = document.createElement("div");
    wrapper.className = `chat-message ${message.role}`;
    const header = document.createElement("div");
    header.className = "d-flex justify-content-between align-items-center mb-1";

    const roleLabel = document.createElement("div");
    roleLabel.className = "chat-message__role";
    roleLabel.textContent = getRoleLabel(message.role);
    header.appendChild(roleLabel);

    const timestamp = document.createElement("div");
    timestamp.className = "small text-muted";
    timestamp.textContent = formatTime(message.timestamp);
    header.appendChild(timestamp);

    wrapper.appendChild(header);

    const body = document.createElement("div");
    body.innerText = message.content;
    wrapper.appendChild(body);

    if (message.tools && message.tools.length) {
      const toolsWrapper = document.createElement("div");
      toolsWrapper.className = "chat-tools";
      const title = document.createElement("div");
      title.className = "fw-semibold mb-1";
      title.textContent = "Executed tools";
      toolsWrapper.appendChild(title);

      const list = document.createElement("ul");
      message.tools.forEach((tool) => {
        const item = document.createElement("li");
        const summary = tool.resultSummary || "Completed successfully";
        item.innerHTML = `<span class="fw-semibold">${tool.toolName}</span>: ${summary}`;
        list.appendChild(item);
      });
      toolsWrapper.appendChild(list);
      wrapper.appendChild(toolsWrapper);
    }

    elements.chatLog.appendChild(wrapper);
  });

  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function getRoleLabel(role) {
  if (role === "user") return "You";
  if (role === "assistant") return "Assistant";
  return "System";
}

function showChatError(message) {
  elements.chatError.textContent = message;
  elements.chatError.classList.remove("d-none");
}

function hideChatError() {
  elements.chatError.classList.add("d-none");
  elements.chatError.textContent = "";
}

async function handleChatSubmit(event) {
  event.preventDefault();
  hideChatError();
  updateSendButtonState();

  if (!state.tenantId) {
    showChatError("Tenant ID is required before sending chat messages.");
    return;
  }

  const content = elements.chatMessage.value.trim();
  if (!content) {
    updateSendButtonState();
    return;
  }

  addChatMessage("user", content);
  elements.chatMessage.value = "";
  updateSendButtonState();
  setSending(true);

  try {
    const payload = {
      tenantId: state.tenantId,
      message: content,
      sessionId: state.sessionId
    };

    if (state.formId) {
      payload.formId = state.formId;
    }

    if (!state.formId && state.formName) {
      payload.formName = state.formName;
    }

    const response = await apiClient.sendChat(payload);
    if (response.sessionId) {
      state.sessionId = response.sessionId;
      elements.sessionId.textContent = state.sessionId;
    }
    if (response.model) {
      state.chatModel = response.model;
      updateChatModelBadge();
    }
    state.lastTools = response.executedTools || [];
    addChatMessage("assistant", response.assistantMessage || "No response returned.", {
      tools: state.lastTools
    });
  } catch (error) {
    addChatMessage("system", `Chat failed: ${error.message}`);
    showChatError(error.message);
  } finally {
    setSending(false);
    updateSendButtonState();
  }

  if (state.tenantId && state.formId && didSaveSuccessfully(state.lastTools)) {
    await loadPreview(false);
  }
}

function setSending(isSending) {
  elements.sendMessageBtn.disabled = isSending;
  elements.chatSpinner.classList.toggle("d-none", !isSending);
}

async function handleCapturePreview() {
  const iframe = elements.previewContainer.querySelector(".preview-frame");
  if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body) {
    setConnectionStatus("Preview not ready to capture yet.", "text-warning");
    return;
  }

  if (typeof window.html2canvas !== "function") {
    setConnectionStatus("Capture failed: html2canvas not loaded.", "text-danger");
    return;
  }

  setConnectionStatus("Capturing preview...", "text-muted");
  try {
    const canvas = await window.html2canvas(iframe.contentDocument.body, {
      backgroundColor: "#ffffff",
      useCORS: true,
      scale: window.devicePixelRatio || 1
    });
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `preview-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setConnectionStatus("Preview captured.", "text-success");
  } catch (error) {
    setConnectionStatus(`Capture failed: ${error.message}`, "text-danger");
  }
}

function didSaveSuccessfully(tools = []) {
  return tools.some((tool) => {
    const name = (tool.toolName || "").toLowerCase();
    const summary = (tool.resultSummary || "").toLowerCase();
    return name.startsWith("save_formspec") && summary.includes("form saved");
  });
}

function renderPreview(preview) {
  renderMetadata(preview ? preview.metadata : null);
  renderValidationMessages(preview ? preview.validationMessages : []);
  elements.previewContainer.innerHTML = "";

  if (!preview || !preview.html) {
    const empty = document.createElement("div");
    empty.className = "text-muted";
    empty.textContent = "No HTML available yet. Create a page or send a chat request.";
    elements.previewContainer.appendChild(empty);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.className = "preview-frame";
  iframe.title = "Form preview";
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.srcdoc = buildPreviewDocument(preview.html);
  elements.previewContainer.appendChild(iframe);
}

function buildPreviewDocument(html) {
  const bootstrapHref = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";
  const hasDocumentTags = /[<](html|head|body)[\\s>]/i.test(html);
  const fallbackDocument = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">${buildBootstrapLink(
    bootstrapHref
  )}</head><body></body></html>`;
  const parsed = new DOMParser().parseFromString(hasDocumentTags ? html : fallbackDocument, "text/html");
  if (!hasDocumentTags) {
    parsed.body.innerHTML = html;
  }

  const head = parsed.head || parsed.getElementsByTagName("head")[0];
  if (head) {
    if (!head.querySelector(`link[href*="bootstrap"]`)) {
      head.insertAdjacentHTML("beforeend", buildBootstrapLink(bootstrapHref));
    }
  }
  return parsed.documentElement?.outerHTML || html;
}

function buildBootstrapLink(href) {
  return `<link href="${href}" rel="stylesheet">`;
}

function renderMetadata(metadata) {
  elements.metadataPanel.innerHTML = "";

  if (!metadata) {
    const placeholder = document.createElement("div");
    placeholder.className = "text-muted small";
    placeholder.textContent = "Form metadata will show up after loading the preview.";
    elements.metadataPanel.appendChild(placeholder);
    return;
  }

  const entries = [
    { label: "Tenant", value: metadata.tenantId },
    { label: "Form ID", value: metadata.formId },
    { label: "Form name", value: metadata.formName },
    { label: "Version", value: metadata.version },
    { label: "Status", value: metadata.status },
    { label: "Updated", value: formatDate(metadata.updatedUtc) }
  ];

  entries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "metadata-item";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = entry.label;
    item.appendChild(label);

    const value = document.createElement("div");
    value.className = "value";
    value.textContent = entry.value ?? "—";
    item.appendChild(value);

    elements.metadataPanel.appendChild(item);
  });
}

function renderValidationMessages(messages = []) {
  if (!messages || !messages.length) {
    elements.validationPanel.classList.add("d-none");
    elements.validationMessages.innerHTML = "";
    return;
  }

  elements.validationPanel.classList.remove("d-none");
  elements.validationMessages.innerHTML = "";
  messages.forEach((message) => {
    const li = document.createElement("li");
    li.textContent = message;
    elements.validationMessages.appendChild(li);
  });
}

function formatDate(input) {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleString();
}

function formatTime(input) {
  if (!input) return "";
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

init();
