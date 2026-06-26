import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { chatbotService } from '../../services';

const quickQuestions = [
  'Có phòng dưới 2 triệu không?',
  'Phòng cho 2 người',
  'Liên hệ chủ trọ',
  'Quy định thanh toán'
];

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Xin chào! Mình có thể hỗ trợ tìm phòng trọ, xem giá, sức chứa, hướng dẫn liên hệ, cọc phòng, thanh toán và nội quy.'
    }
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: trimmed
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatbotService.sendMessage(trimmed);
      const botMessage = {
        id: `${Date.now()}-bot`,
        role: 'bot',
        text: response?.reply || 'Mình chưa có đủ thông tin để trả lời. Bạn có thể hỏi theo giá, diện tích hoặc số người ở nhé.'
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-bot-error`,
          role: 'bot',
          text: error.message || 'Xin lỗi, hiện tại mình chưa thể trả lời. Bạn thử lại sau nhé.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div
          className="mb-4 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          style={{ width: 'min(92vw, 380px)', height: '560px' }}
        >
          <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold">Trợ lý nhà trọ</h4>
                <p className="text-xs text-white/80">Tư vấn phòng, thanh toán và liên hệ</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng chatbot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-4">
              {messages.map((message) => {
                const isUser = message.role === 'user';

                return (
                <div key={message.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="whitespace-pre-line break-words rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm"
                    style={{
                      maxWidth: isUser ? '82%' : '88%',
                      minWidth: isUser ? '120px' : undefined,
                      overflowWrap: 'anywhere',
                      wordBreak: 'normal',
                      backgroundColor: isUser ? '#2563eb' : '#f3f4f6',
                      color: isUser ? '#ffffff' : '#1f2937',
                      fontWeight: isUser ? '500' : 'normal'
                    }}
                  >
                    {message.text}
                  </div>
                </div>
                );
              })}
              {isLoading && (
                <div className="text-left">
                  <div className="inline-block rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-500">
                    Đang trả lời...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-gray-200 bg-white p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendMessage(question)}
                  disabled={isLoading}
                  className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {question}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập câu hỏi của bạn..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Gửi tin nhắn"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-2xl transition-transform hover:scale-105"
        aria-label="Mở chatbot"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
