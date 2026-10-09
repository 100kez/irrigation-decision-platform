import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Image as ImageIcon,
  Bot,
  User,
  Info,
  Sparkles,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { aiDiagnosticApi } from '@/api/ai-diagnostic';
import { useAiDiagnostic } from '@/contexts/AiDiagnosticContext';
import type {
  AiChatMessage,
  AiDiagnosticCriterion,
} from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const AiDiagnosticChat: React.FC = () => {
  const { updateDiagnostic } = useAiDiagnostic();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingImages, setPendingImages] = useState<string[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content:
            '您好！我是农业诊断助手 🌱\n\n您可以描述作物的异常状况，也可以上传照片。我会帮您初步判断原因，并提供建议。\n\n比如您可以说：\n· "玉米叶子发黄了"\n· "叶片上有斑点"\n· "苗子打蔫了"',
        },
      ]);
    }
  }, [isOpen, messages.length]);

  // 部分浏览器/文件管理器上报的 file.type 为空串,按扩展名兜底判断
  const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp)$/i;
  const isImageFile = (file: File): boolean =>
    file.type.startsWith('image/') || IMAGE_EXTENSIONS.test(file.name);

  /** 压缩到最长边 1280px 的 JPEG,避免大图 base64 超出请求体限制 */
  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const maxSide = 1280;
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve(dataUrl); // 无法解码(如 HEIC)时退回原图
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!isImageFile(file)) {
      toast.error('仅支持上传图片文件(jpg/png/gif/webp 等)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const result = event.target?.result as string;
      if (!result) return;
      void compressImage(result).then((compressed: string) => {
        setPendingImages((prev: string[]) => [...prev, compressed]);
      });
    };
    reader.onerror = () => toast.error('图片读取失败,请重试');
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev: string[]) => prev.filter((_, i: number) => i !== index));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && pendingImages.length === 0) return;
    if (loading) return;

    const userMessage: AiChatMessage = {
      role: 'user',
      content: text || '(用户上传了图片)',
      imageUrls: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };

    const newMessages: AiChatMessage[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setPendingImages([]);
    setLoading(true);

    try {
      const response = await aiDiagnosticApi.chat({
        messages: newMessages,
      });

      const assistantMessage: AiChatMessage = {
        role: 'assistant',
        content: response.reply,
      };

      const allMessages: AiChatMessage[] = [...newMessages, assistantMessage];
      setMessages(allMessages);

      if (response.criteria && response.criteria.length > 0) {
        updateDiagnostic(
          response.criteria,
          response.diagnosticSummary || '',
          allMessages,
        );
      }
    } catch (err: unknown) {
      logger.error('AI 对话失败', err);
      // 展示服务端真实错误信息(框架错误信封为 data.error.message)
      const errData = (
        err as {
          response?: { data?: { error?: { message?: string }; message?: string } };
        }
      )?.response?.data;
      const serverMsg = errData?.error?.message ?? errData?.message;
      const errorMsg: AiChatMessage = {
        role: 'assistant',
        content: serverMsg
          ? `诊断失败:${serverMsg}`
          : '抱歉，诊断服务暂时不可用，请稍后再试。',
      };
      setMessages((prev: AiChatMessage[]) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-6 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-all hover:bg-emerald-700 hover:shadow-xl hover:scale-105"
        aria-label="打开 AI 诊断助手"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-emerald-100 max-sm:inset-x-2 max-sm:top-[calc(env(safe-area-inset-top)+4rem)] max-sm:bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] max-sm:h-auto max-sm:w-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI 诊断助手</div>
            <div className="text-[11px] text-emerald-100">
              作物问题智能诊断
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          aria-label="关闭对话"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Image notice */}
      <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <span>
          图片仅供参考，识别效果取决于模型能力，请尽量补充文字描述
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.map((msg: AiChatMessage, idx: number) => (
          <div
            key={idx}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white'}`}
            >
              {msg.role === 'user' ? (
                <User className="h-3.5 w-3.5" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
            </div>
            <div
              className={`max-w-[260px] max-sm:max-w-[72%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-gray-100 text-foreground rounded-tl-sm'}`}
            >
              {msg.imageUrls && msg.imageUrls.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {msg.imageUrls.map((url: string, i: number) => (
                    <Image
                      key={i}
                      src={url}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending images */}
      {pendingImages.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2">
          <div className="flex flex-wrap gap-2">
            {pendingImages.map((url: string, idx: number) => (
              <div key={idx} className="relative">
                <Image
                  src={url}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <button
                  onClick={() => removePendingImage(idx)}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="上传图片"
          >
            <ImageIcon className="h-4 w-4 text-emerald-600" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述作物情况..."
            className="flex-1 h-9 text-sm"
          />
          <Button
            size="icon"
            className="h-9 w-9 flex-shrink-0 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => void handleSend()}
            disabled={loading || (!input.trim() && pendingImages.length === 0)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AiDiagnosticChat;
