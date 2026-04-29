import type { Message, MessageContentItem } from './store/chatSlice';

export async function checkHealth(): Promise<boolean> {
    try {
        const res = await fetch('/v1/models', {
            signal: AbortSignal.timeout(5000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function streamChat(
    messages: Message[],
    settings: {
        model: string;
        temperature: number;
        maxTokens: number;
        topP: number;
    },
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (err: Error) => void,
): Promise<void> {
    const body = {
        model: settings.model || 'Qwen/Qwen2.5-VL-7B-Instruct-AWQ',
        messages,
        temperature: settings.temperature ?? 0.7,
        max_tokens: settings.maxTokens ?? 2048,
        top_p: settings.topP ?? 0.9,
        stream: true,
    };

    try {
        const res = await fetch('/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`API error ${res.status}: ${err}`);
        }

        if (!res.body) throw new Error('Response body is null');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const data = trimmed.slice(6);
                if (data === '[DONE]') {
                    onDone();
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) onToken(delta);
                } catch {
                    /* ignore */
                }
            }
        }
        onDone();
    } catch (err) {
        onError(err);
    }
}

export function fileToBase64(file: File): Promise<string | ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function buildVLMessage(
    role: 'user' | 'assistant' | 'system',
    text: string,
    imageDataUrls: string[] = [],
): Message {
    if (role === 'user' && imageDataUrls.length > 0) {
        const content: MessageContentItem[] = [];
        for (const url of imageDataUrls) {
            content.push({ type: 'image_url', image_url: { url } });
        }
        if (text) content.push({ type: 'text', text });
        return { role, content };
    }
    return { role, content: text };
}
