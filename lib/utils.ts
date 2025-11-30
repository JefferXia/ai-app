import {
  CoreAssistantMessage,
  CoreMessage,
  CoreToolMessage,
  generateId,
  Message,
  ToolInvocation,
} from 'ai'
import axios from 'axios'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Readable } from 'stream'
import { Chat } from '@/db/schema'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      'An error occurred while fetching the data.'
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function addToolMessageToChat({
  toolMessage,
  messages,
}: {
  toolMessage: CoreToolMessage;
  messages: Array<Message>;
}): Array<Message> {
  return messages.map((message) => {
    if (message.toolInvocations) {
      return {
        ...message,
        toolInvocations: message.toolInvocations.map((toolInvocation) => {
          const toolResult = toolMessage.content.find(
            (tool) => tool.toolCallId === toolInvocation.toolCallId
          );

          if (toolResult) {
            return {
              ...toolInvocation,
              state: 'result',
              result: toolResult.result,
            };
          }

          return toolInvocation;
        }),
      };
    }

    return message;
  });
}

export function convertToUIMessages(
  messages: Array<CoreMessage>
): Array<Message> {
  return messages.reduce((chatMessages: Array<Message>, message) => {
    if (message.role === 'tool') {
      return addToolMessageToChat({
        toolMessage: message as CoreToolMessage,
        messages: chatMessages,
      });
    }

    let textContent = '';
    let toolInvocations: Array<ToolInvocation> = [];

    if (typeof message.content === 'string') {
      textContent = message.content;
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === 'text') {
          textContent += content.text;
        } else if (content.type === 'tool-call') {
          toolInvocations.push({
            state: 'call',
            toolCallId: content.toolCallId,
            toolName: content.toolName,
            args: content.args,
          });
        }
      }
    }

    chatMessages.push({
      id: generateId(),
      role: message.role,
      content: textContent,
      toolInvocations,
    });

    return chatMessages;
  }, []);
}

export function getTitleFromChat(chat: Chat) {
  const messages = convertToUIMessages(chat.messages as Array<CoreMessage>);
  const firstMessage = messages[0];

  if (!firstMessage) {
    return 'Untitled';
  }

  return firstMessage.content;
}

const emptyAssistantMessage = [
  {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: '',
      },
    ],
  },
];

export function sanitizeResponseMessages(
  messages: Array<CoreToolMessage | CoreAssistantMessage>
): Array<CoreToolMessage | CoreAssistantMessage> {
  let toolResultIds: Array<string> = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      for (const content of message.content) {
        if (content.type === 'tool-result') {
          toolResultIds.push(content.toolCallId);
        }
      }
    }
  }

  const messagesBySanitizedContent = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (typeof message.content === 'string') return message;

    const sanitizedContent = message.content.filter((content) =>
      content.type === 'tool-call'
        ? toolResultIds.includes(content.toolCallId)
        : content.type === 'text'
          ? content.text.length > 0
          : true
    );

    return {
      ...message,
      content: sanitizedContent,
    };
  });

  return messagesBySanitizedContent.filter(
    (message) => message.content.length > 0
  );
}

export function sanitizeUIMessages(messages: Array<Message>): Array<Message> {
  const messagesBySanitizedToolInvocations = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (!message.toolInvocations) return message;

    let toolResultIds: Array<string> = [];

    for (const toolInvocation of message.toolInvocations) {
      if (toolInvocation.state === 'result') {
        toolResultIds.push(toolInvocation.toolCallId);
      }
    }

    const sanitizedToolInvocations = message.toolInvocations.filter(
      (toolInvocation) =>
        toolInvocation.state === 'result' ||
        toolResultIds.includes(toolInvocation.toolCallId)
    );

    return {
      ...message,
      toolInvocations: sanitizedToolInvocations,
    };
  });

  return messagesBySanitizedToolInvocations.filter(
    (message) =>
      message.content.length > 0 ||
      (message.toolInvocations && message.toolInvocations.length > 0)
  );
}

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

export const Regex = {
  // URL regex
  URL: /^https:\/\/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=%]*)?$/i
}

// export const DEMO_USER_ID = 'utest'
export const DEMO_USER_ID = 'a3192a56-34a8-4c6c-9a5a-6aa6bb9bf132'

// 拿到一个字符串，并获取首字母大写
export function getFirstLetterAndUpperCase(str: string) {
  if (str && typeof str === 'string') {
    return str.charAt(0).toUpperCase()
  }
  return ''
}

export function utcToBeijing(time: Date|string) {
  return new Date(time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

const streamToBuffer = (stream: Readable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    // 当流的数据到达时，收集数据块
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // 流结束时，将数据块合并为一个 Buffer
    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    // 如果流出错，返回错误
    stream.on('error', (err: Error) => {
      reject(err);
    });
  });
}

export async function videoStreamToBuffer(videoUrl: string) {
  try {
    const response = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream'
    });
    
    // 将视频流转换为 Buffer
    const videoBuffer = await streamToBuffer(response.data)
    return videoBuffer
  } catch (error: any) {
    console.error('发生错误', error.message);
  }
}

export async function downloadVideoUrl(videoUrl: string) {
  try {
    axios({
      method: 'GET',
      url: videoUrl
    })
  } catch (error: any) {
    console.error('发生错误', error.message);
  }
}

export async function videoUrlToBuffer(videoUrl: string) {
  try {
    const response = await axios.get(videoUrl, {
      responseType: "arraybuffer", // 确保响应是二进制数据
    });

    const buffer = Buffer.from(response.data);
    return buffer;
  } catch (error: any) {
    console.error("Error downloading video:", error.message);
  }
}

/**
 * 检测URL是否为支持的商品详情页URL
 * 支持的平台：京东(JD)、天猫(Tmall)、淘宝(Taobao)
 * @param url - 要检测的URL字符串
 * @returns 如果是支持的详情页URL返回true，否则返回false
 */
export function isProductDetailUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    const pathname = urlObj.pathname.toLowerCase()
    
    // 京东商品详情页
    if (hostname === 'item.jd.com' && pathname.includes('.html')) {
      return true
    }
    
    // 天猫商品详情页
    if (hostname === 'detail.tmall.com' && urlObj.searchParams.has('id')) {
      return true
    }
    
    // 淘宝商品详情页
    if (hostname === 'item.taobao.com' && urlObj.searchParams.has('id')) {
      return true
    }
    
    // 抖音商品详情页
    if (hostname === 'haohuo.jinritemai.com' && urlObj.searchParams.has('id')) {
      return true
    }
    
    return false
  } catch (error) {
    console.error('检测商品详情URL失败:', error)
    return false
  }
}

/**
 * 从URL中提取商品ID
 * 支持从URL参数和路径中提取ID
 * @param url - 要解析的URL字符串
 * @returns 商品ID字符串，如果未找到则返回null
 */
export function extractProductId(url: string): string | null {
  try {
    // 首先检测是否为支持的详情页URL
    if (!isProductDetailUrl(url)) {
      return null
    }
    
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    let productId: string | null = null
    
    // 京东商品ID提取 - 从路径中提取
    if (hostname.includes('jd.com')) {
      const regex = /\/(\d+)\.html/
      const match = url.match(regex)
      if (match && match[1]) {
        productId = match[1]
      }
    } else {
      productId = urlObj.searchParams.get('id')
    }
    
    return productId
  } catch (error) {
    console.error('提取商品ID失败:', error)
    return null
  }
}