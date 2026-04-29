import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface MessageContentItem {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string | MessageContentItem[];
    timestamp?: number;
}

export interface Settings {
    model: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    systemPrompt: string;
}

export interface UIState {
    messages: Message[];
    pendingImages: { file: File; dataUrl: string }[];
    isStreaming: boolean;
    isOnline: boolean;
    settings: Settings;
    currentPrompt: string;
}

const initialState: UIState = {
    messages: [],
    pendingImages: [],
    isStreaming: false,
    isOnline: false,
    settings: {
        model: 'Qwen/Qwen2.5-VL-7B-Instruct-AWQ',
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
        systemPrompt:
            'You are Qwen, a helpful vision-language assistant. You can analyze images and answer questions about them.',
    },
    currentPrompt: '',
};

const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        addMessage: (state, action: PayloadAction<Message>) => {
            state.messages.push(action.payload);
        },
        updateLastMessage: (state, action: PayloadAction<string>) => {
            const lastMessage = state.messages[state.messages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.content += action.payload;
            }
        },
        clearMessages: (state) => {
            state.messages = [];
        },
        setStreaming: (state, action: PayloadAction<boolean>) => {
            state.isStreaming = action.payload;
        },
        setOnline: (state, action: PayloadAction<boolean>) => {
            state.isOnline = action.payload;
        },
        addPendingImage: (
            state,
            action: PayloadAction<{ file: File; dataUrl: string }>,
        ) => {
            state.pendingImages.push(action.payload);
        },
        clearPendingImages: (state) => {
            state.pendingImages = [];
        },
        removePendingImage: (state, action: PayloadAction<number>) => {
            state.pendingImages.splice(action.payload, 1);
        },
        updateSettings: (state, action: PayloadAction<Partial<Settings>>) => {
            state.settings = { ...state.settings, ...action.payload };
        },
        setCurrentPrompt: (state, action: PayloadAction<string>) => {
            state.currentPrompt = action.payload;
        },
    },
});

export const {
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
} = chatSlice.actions;

export default chatSlice.reducer;
