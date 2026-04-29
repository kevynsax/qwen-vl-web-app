import './style.scss';
import { icons } from './icons';
import { checkHealth, streamChat, fileToBase64, buildVLMessage } from './api';
import { store } from './store';
import {
    addMessage,
    updateLastMessage,
    clearMessages,
    setStreaming,
    setOnline,
    addPendingImage,
    clearPendingImages,
    removePendingImage,
    updateSettings,
    setCurrentPrompt,
} from './store/chatSlice';

const getApp = () => document.getElementById('app')!;
const getState = () => store.getState().chat;
let isWindowDropEventsBound = false;

function getDropOverlay() {
    return document.getElementById('drop-overlay');
}

function handleWindowDragOver(e: DragEvent) {
    e.preventDefault();
    getDropOverlay()?.classList.add('active');
}

function handleWindowDragLeave(e: DragEvent) {
    if (e.relatedTarget === null) {
        getDropOverlay()?.classList.remove('active');
    }
}

function handleWindowDrop(e: DragEvent) {
    e.preventDefault();
    getDropOverlay()?.classList.remove('active');
    const files = e.dataTransfer?.files;
    if (files) {
        Array.from(files).forEach(handleFileUpload);
    }
}

function render() {
    const state = getState();
    getApp().innerHTML = `
    <header class="header">
      <div class="header-brand">
        <div class="header-logo">${icons.eye}</div>
        <div>
          <div class="header-title">Qwen VL Playground</div>
          <div class="header-subtitle">Qwen2.5-VL-7B — Vision & Language</div>
        </div>
      </div>
      <div class="header-actions">
        <div class="status-dot ${state.isOnline ? 'online' : 'offline'}"></div>
        <span class="status-label">${state.isOnline ? 'Online' : 'Offline'}</span>
        <button class="btn-icon" id="btn-clear" title="Clear chat">${icons.trash}</button>
        <button class="btn-icon" id="btn-settings" title="Settings">${icons.settings}</button>
      </div>
    </header>

    <div class="chat-area" id="chat-area">
      ${state.messages.length === 0 ? renderEmpty() : renderMessages()}
    </div>

    <div class="input-area">
      ${renderImagePreviews()}
      <div class="input-row">
        <div class="input-wrapper">
          <button class="btn-attach" id="btn-attach" title="Attach image">${icons.image}</button>
          <textarea id="prompt-input" rows="1" placeholder="Describe an image, ask a question, or upload an image…">${state.currentPrompt}</textarea>
        </div>
        ${
            state.isStreaming
                ? `<button class="btn-send" id="btn-stop" title="Stop">${icons.stop}</button>`
                : `<button class="btn-send" id="btn-send" title="Send" ${!state.isOnline ? 'disabled' : ''}>${icons.send}</button>`
        }
      </div>
      <div class="input-hint">Drag & drop images or click 📎 to attach • Enter to send • Shift+Enter for new line</div>
      <input type="file" id="file-input" accept="image/*" multiple hidden />
    </div>

    <div class="overlay" id="overlay"></div>
    <div class="settings-panel" id="settings-panel">
      <div class="settings-header">
        <h3>Settings</h3>
        <button class="btn-icon" id="btn-close-settings">${icons.close}</button>
      </div>
      <div class="settings-body">
        <div class="setting-group">
          <label class="setting-label">Model <span class="setting-value" id="val-model"></span></label>
          <input class="setting-input" id="set-model" type="text" value="${state.settings.model}" />
        </div>
        <div class="setting-group">
          <label class="setting-label">Temperature <span class="setting-value" id="val-temp">${state.settings.temperature}</span></label>
          <input type="range" id="set-temp" min="0" max="2" step="0.05" value="${state.settings.temperature}" />
        </div>
        <div class="setting-group">
          <label class="setting-label">Max Tokens <span class="setting-value" id="val-tokens">${state.settings.maxTokens}</span></label>
          <input type="range" id="set-tokens" min="128" max="8192" step="128" value="${state.settings.maxTokens}" />
        </div>
        <div class="setting-group">
          <label class="setting-label">Top P <span class="setting-value" id="val-topp">${state.settings.topP}</span></label>
          <input type="range" id="set-topp" min="0" max="1" step="0.05" value="${state.settings.topP}" />
        </div>
        <div class="setting-group">
          <label class="setting-label">System Prompt</label>
          <textarea class="setting-input" id="set-system" rows="4" style="resize:vertical">${state.settings.systemPrompt}</textarea>
        </div>
      </div>
    </div>

    <div class="drop-overlay" id="drop-overlay">
      <div class="drop-label">📎 Drop images here</div>
    </div>
  `;
    bindEvents();
    scrollToBottom();
    autoResize();
}

function renderEmpty() {
    return `
    <div class="empty-state">
      <div class="empty-icon">${icons.eye}</div>
      <h2>Ready to see and chat</h2>
      <p>Upload an image and ask Qwen to describe it, or just start a conversation.</p>
      <div class="empty-suggestions">
        <button class="suggestion-chip" id="suggestion-1">"What is in this image?"</button>
        <button class="suggestion-chip" id="suggestion-2">"Can you write code for this UI?"</button>
        <button class="suggestion-chip" id="suggestion-3">"Tell me a story about..."</button>
      </div>
    </div>
  `;
}

function renderMessages() {
    const state = getState();
    return state.messages
        .map(
            (m, i) => `
    <div class="message ${m.role}">
      <div class="message-avatar">
        ${m.role === 'user' ? 'U' : 'AI'}
      </div>
      <div class="message-content">
        <div class="message-bubble">
          ${
              Array.isArray(m.content)
                  ? `
            <div class="message-images">
              ${m.content
                  .filter((c) => c.type === 'image_url')
                  .map(
                      (c) =>
                          `<img src="${c.image_url?.url}" class="message-image" />`,
                  )
                  .join('')}
            </div>
            <div>
              ${m.content
                  .filter((c) => c.type === 'text')
                  .map((c) => c.text)
                  .join('')}
            </div>
          `
                  : m.content
          }
        </div>
      </div>
    </div>
  `,
        )
        .join('');
}

function renderImagePreviews() {
    const state = getState();
    if (state.pendingImages.length === 0) return '';
    return `
    <div class="image-preview-bar">
      ${state.pendingImages
          .map(
              (img, i) => `
        <div class="image-preview-item">
          <img src="${img.dataUrl}" />
          <button class="image-preview-remove" data-index="${i}">${icons.close}</button>
        </div>
      `,
          )
          .join('')}
    </div>
  `;
}

function bindEvents() {
    const input = document.getElementById(
        'prompt-input',
    ) as HTMLTextAreaElement;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;

    document.getElementById('btn-send')?.addEventListener('click', handleSend);
    document
        .getElementById('btn-stop')
        ?.addEventListener('click', () => controller?.abort());
    document
        .getElementById('btn-attach')
        ?.addEventListener('click', () => fileInput.click());
    document.getElementById('btn-clear')?.addEventListener('click', () => {
        store.dispatch(clearMessages());
        render();
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
        document.getElementById('settings-panel')?.classList.add('open');
        document.getElementById('overlay')?.classList.add('active');
    });

    document
        .getElementById('btn-close-settings')
        ?.addEventListener('click', () => {
            document.getElementById('settings-panel')?.classList.remove('open');
            document.getElementById('overlay')?.classList.remove('active');
        });

    document.querySelectorAll('.image-preview-remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(
                (e.currentTarget as HTMLElement).dataset.index!,
            );
            store.dispatch(removePendingImage(idx));
            render();
        });
    });

    fileInput.addEventListener('change', async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files) Array.from(files).forEach(handleFileUpload);
    });

    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    input?.addEventListener('input', (e) => {
        store.dispatch(setCurrentPrompt((e.target as HTMLTextAreaElement).value));
    });

    document
        .getElementById('suggestion-1')
        ?.addEventListener('click', () => setPrompt('What is in this image?'));
    document
        .getElementById('suggestion-2')
        ?.addEventListener('click', () =>
            setPrompt('Can you write code for this UI?'),
        );
    document
        .getElementById('suggestion-3')
        ?.addEventListener('click', () =>
            setPrompt('Tell me a story about...'),
        );

    ['temp', 'tokens', 'topp'].forEach((id) => {
        document.getElementById(`set-${id}`)?.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            const key =
                id === 'temp'
                    ? 'temperature'
                    : id === 'tokens'
                      ? 'maxTokens'
                      : 'topP';
            store.dispatch(updateSettings({ [key]: parseFloat(val) }));
            document.getElementById(`val-${id}`)!.textContent = val;
        });
    });

    document.getElementById('set-model')?.addEventListener('change', (e) => {
        store.dispatch(
            updateSettings({ model: (e.target as HTMLInputElement).value }),
        );
    });

    document.getElementById('set-system')?.addEventListener('change', (e) => {
        store.dispatch(
            updateSettings({
                systemPrompt: (e.target as HTMLTextAreaElement).value,
            }),
        );
    });

    // Bind global drag and drop listeners once; render() is called often.
    if (!isWindowDropEventsBound) {
        window.addEventListener('dragover', handleWindowDragOver);
        window.addEventListener('dragleave', handleWindowDragLeave);
        window.addEventListener('drop', handleWindowDrop);
        isWindowDropEventsBound = true;
    }
}

let controller: AbortController | null = null;

async function handleSend() {
    const state = getState();
    const input = document.getElementById(
        'prompt-input',
    ) as HTMLTextAreaElement;
    const prompt = input.value.trim();
    if ((!prompt && state.pendingImages.length === 0) || state.isStreaming)
        return;

    const imageUrls = state.pendingImages.map((p) => p.dataUrl);
    const userMsg = buildVLMessage('user', prompt, imageUrls);

    store.dispatch(addMessage(userMsg));
    store.dispatch(clearPendingImages());
    store.dispatch(setCurrentPrompt(''));
    store.dispatch(setStreaming(true));
    input.value = '';
    render();

    controller = new AbortController();

    const apiMessages: Message[] = [
        { role: 'system', content: state.settings.systemPrompt },
        ...getState().messages.map((m) => ({
            role: m.role,
            content: m.content,
        })),
    ];

    store.dispatch(addMessage({ role: 'assistant', content: '' }));

    try {
        await streamChat(
            apiMessages,
            state.settings,
            (token) => {
                store.dispatch(updateLastMessage(token));
                render();
            },
            () => {
                store.dispatch(setStreaming(false));
                render();
            },
            (err) => {
                console.error(err);
                store.dispatch(
                    updateLastMessage(`\n\n**Error:** ${err.message}`),
                );
                store.dispatch(setStreaming(false));
                render();
            },
        );
    } catch (e) {
        store.dispatch(setStreaming(false));
        render();
    }
}

async function handleFileUpload(file: File) {
    try {
        const dataUrl = await fileToBase64(file);
        if (dataUrl) {
            store.dispatch(
                addPendingImage({ file, dataUrl: dataUrl as string }),
            );
            render();
        }
    } catch (err) {
        console.error('File read error:', err);
    }
}

function scrollToBottom() {
    const area = document.getElementById('chat-area');
    if (area) area.scrollTop = area.scrollHeight;
}

function autoResize() {
    const textarea = document.getElementById(
        'prompt-input',
    ) as HTMLTextAreaElement;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    textarea.addEventListener('input', autoResize);
}

function setPrompt(text: string) {
    store.dispatch(setCurrentPrompt(text));
    render();
    const input = document.getElementById(
        'prompt-input',
    ) as HTMLTextAreaElement;
    if (input) {
        autoResize();
        input.focus();
    }
}

async function init() {
    render();
    const alive = await checkHealth();
    store.dispatch(setOnline(alive));
    render();

    setInterval(async () => {
        const living = await checkHealth();
        if (living !== getState().isOnline) {
            store.dispatch(setOnline(living));
            render();
        }
    }, 30000);
}

init();
