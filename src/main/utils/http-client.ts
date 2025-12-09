/**
 * 统一的 HTTP 客户端
 *
 * 基于 axios 构建，专为 Electron 环境优化
 * 解决了 node-fetch 在 asar 打包时的兼容性问题
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from './logger';

/**
 * 创建一个带有默认配置的 axios 实例
 */
export function createHttpClient(config?: AxiosRequestConfig): AxiosInstance {
  const client = axios.create({
    timeout: 30000, // 30秒超时
    headers: {
      'Content-Type': 'application/json',
    },
    ...config,
  });

  // 请求拦截器 - 日志记录
  client.interceptors.request.use(
    (config) => {
      logger.log(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      logger.error('[HTTP] Request error:', error.message);
      return Promise.reject(error);
    }
  );

  // 响应拦截器 - 错误处理和日志
  client.interceptors.response.use(
    (response) => {
      logger.log(`[HTTP] ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      if (error.response) {
        // 服务器返回了错误状态码
        logger.error(`[HTTP] ${error.response.status} ${error.config?.url}`, error.response.data);
      } else if (error.request) {
        // 请求已发送但没有收到响应
        logger.error('[HTTP] No response received:', error.message);
      } else {
        // 请求配置出错
        logger.error('[HTTP] Request setup error:', error.message);
      }
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * 默认的 HTTP 客户端实例
 */
export const httpClient = createHttpClient();

/**
 * 流式请求处理器
 * 用于处理 Server-Sent Events (SSE) 格式的流式响应
 */
export async function* streamSSE(
  url: string,
  options: AxiosRequestConfig
): AsyncGenerator<string, void, unknown> {
  try {
    const response = await axios({
      url,
      method: 'POST',
      responseType: 'stream',
      ...options,
    });

    const stream = response.data;
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');

      // 保留最后一个不完整的行
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            return;
          }
          yield data;
        }
      }
    }
  } catch (error: any) {
    logger.error('[HTTP Stream] Error:', error.message);
    throw error;
  }
}
