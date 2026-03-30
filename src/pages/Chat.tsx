import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getTotalCompanyCount } from '../lib/db';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function Chat() {
  const { settings, clients, shares } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello Taslim! I'm Jarvis, your AI assistant in DealFlow. I can help with data strategy, client management, filtering advice, enrichment ideas, and deal sourcing tips. What would you like to work on?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyCount, setCompanyCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTotalCompanyCount().then(setCompanyCount);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      if (!settings.aiApiKey) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: "I need an API key to chat with you. Head over to **Settings** and add your OpenAI or Anthropic API key. For real-world tasks, tell me to 'Send to Jarvis on Telegram'!",
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      const systemPrompt = `You are Jarvis — Taslim's AI assistant in DealFlow.
DealFlow is a company intelligence platform for deal sourcing and lead generation.
You can see: ${companyCount} companies, ${clients.length} clients, ${shares.length} active shares.
Help with: data strategy, client management, filtering advice, enrichment ideas, deal sourcing tips, lead generation strategy.
For real-world tasks, tell him to tap "Send to Jarvis on Telegram".
Be concise, witty, and helpful. Use markdown formatting.`;

      const isAnthropic = settings.aiProvider === 'anthropic';
      const url = isAnthropic
        ? 'https://api.anthropic.com/v1/messages'
        : 'https://api.openai.com/v1/chat/completions';

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: string;

      if (isAnthropic) {
        headers['x-api-key'] = settings.aiApiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
        body = JSON.stringify({
          model: settings.aiModel || 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [...messages, userMsg].filter((m) => m.role !== 'assistant' || m.id !== '1').map((m) => ({ role: m.role, content: m.content })),
        });
      } else {
        headers['Authorization'] = `Bearer ${settings.aiApiKey}`;
        body = JSON.stringify({
          model: settings.aiModel || 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            ...[...messages, userMsg].filter((m) => m.id !== '1').map((m) => ({ role: m.role, content: m.content })),
          ],
        });
      }

      const res = await fetch(url, { method: 'POST', headers, body });
      const data = await res.json();

      const content = isAnthropic
        ? data.content?.[0]?.text || 'No response'
        : data.choices?.[0]?.message?.content || 'No response';

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content, timestamp: new Date().toISOString() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#0A2540]">🤖 Jarvis</h1>
        <p className="text-sm text-[#596880]">Your AI assistant for deal sourcing & lead generation</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'assistant' ? 'bg-[#F0EEFF] text-[#635BFF]' : 'bg-[#0A2540] text-white'}`}>
              {m.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${m.role === 'assistant' ? 'bg-white border border-[#E3E8EE]' : 'bg-[#635BFF] text-white'}`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#F0EEFF] flex items-center justify-center text-[#635BFF]">
              <Bot size={16} />
            </div>
            <div className="bg-white border border-[#E3E8EE] rounded-xl px-4 py-3">
              <Loader2 size={16} className="animate-spin text-[#635BFF]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-[#E3E8EE]">
        <input
          className="input-field flex-1"
          placeholder="Ask Jarvis anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <button className="btn-primary" onClick={handleSend} disabled={loading || !input.trim()}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
