/**
 * utils.mjs - bug-fixer-workflow 共享工具模块
 * 纯 Node.js 内置模块，无外部依赖
 */

import { fileURLToPath } from 'url';
import { resolve, join, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import http from 'http';
import https from 'https';
import { URL } from 'url';

/**
 * ANSI 颜色代码（替代 chalk）
 */
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // 前景色
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // 背景色
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

/**
 * 带颜色的日志输出（替代 chalk）
 */
export const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bright}${colors.green}${msg}${colors.reset}`),
};

/**
 * 跨平台命令执行（替代 cross-platform-exec.mjs）
 */
export function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe', ...options });
  } catch (error) {
    const msg = error.stderr ? error.stderr.toString() : error.message;
    throw new Error(`Command failed: ${command}\n${msg}`);
  }
}

/**
 * HTTP/HTTPS GET 请求（自动检测协议）
 * @param {string} url - 请求 URL
 * @param {Object} options - 选项 { headers, auth, timeout }
 * @returns {Promise<Object>} - 响应数据
 */
export function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { headers = {}, auth = {}, timeout = 30000 } = options;
    const urlObj = new URL(url);

    // 添加 Basic Auth
    if (auth.username && auth.password) {
      const authStr = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${authStr}`;
    }

    // 根据 URL 协议选择模块和默认端口
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || defaultPort,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Node.js HTTP Client',
        'Accept': 'application/json',
        ...headers,
      },
      timeout,
    };

    // HTTPS 自签证书选项
    if (isHttps) {
      reqOptions.rejectUnauthorized = false;
    }

    const req = httpModule.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`HTTP request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP request timeout'));
    });

    req.end();
  });
}

/**
 * HTTP/HTTPS PUT/POST 请求（自动检测协议）
 * @param {string} url - 请求 URL
 * @param {Object} data - 请求体数据
 * @param {Object} options - 选项 { headers, auth, timeout, method }
 * @returns {Promise<Object>} - 响应数据
 */
export function httpsRequest(url, data = null, options = {}) {
  return new Promise((resolve, reject) => {
    const { headers = {}, auth = {}, timeout = 30000, method = 'PUT' } = options;
    const urlObj = new URL(url);

    // 添加 Basic Auth
    if (auth.username && auth.password) {
      const authStr = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${authStr}`;
    }

    const postData = data ? JSON.stringify(data) : null;

    // 根据 URL 协议选择模块和默认端口
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || defaultPort,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'User-Agent': 'Node.js HTTP Client',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) }),
        ...headers,
      },
      timeout,
    };

    // HTTPS 自签证书选项
    if (isHttps) {
      reqOptions.rejectUnauthorized = false;
    }

    const req = httpModule.request(reqOptions, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(responseData);
            resolve(jsonData);
          } catch {
            resolve(responseData);
          }
        } else {
          reject(new Error(`HTTP error: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`HTTP request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP request timeout'));
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

/**
 * 下载文件（自动检测协议）
 * @param {string} url - 文件 URL
 * @param {Object} options - 选项 { headers, auth, timeout }
 * @returns {Promise<Buffer>} - 文件内容
 */
export function httpsDownload(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { headers = {}, auth = {}, timeout = 60000 } = options;
    const urlObj = new URL(url);

    // 添加 Basic Auth
    if (auth.username && auth.password) {
      const authStr = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${authStr}`;
    }

    // 根据 URL 协议选择模块和默认端口
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || defaultPort,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Node.js HTTP Client',
        ...headers,
      },
      timeout,
    };

    // HTTPS 自签证书选项
    if (isHttps) {
      reqOptions.rejectUnauthorized = false;
    }

    const req = httpModule.request(reqOptions, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`HTTP download error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`HTTP download failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP download timeout'));
    });

    req.end();
  });
}

/**
 * 解析命令行参数（替代 commander）
 * @param {string[]} args - process.argv.slice(2)
 * @param {Object} schema - 参数模式 { named: ['--dry-run'], positional: ['ISSUE_ID', 'NOTES'] }
 * @returns {Object} - 解析后的参数 { dryRun: true, ISSUE_ID: '123', NOTES: 'xxx' }
 */
export function parseArgs(args, schema = {}) {
  const result = { named: {}, positional: [] };
  const named = new Set(schema.named || []);

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (named.has(key)) {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          result.named[key] = nextArg;
          i += 2;
        } else {
          result.named[key] = true;
          i += 1;
        }
      } else {
        i += 1;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (named.has(key)) {
        result.named[key] = true;
      }
      i += 1;
    } else {
      result.positional.push(arg);
      i += 1;
    }
  }

  if (schema.positional) {
    schema.positional.forEach((name, index) => {
      if (index < result.positional.length) {
        result.named[name] = result.positional[index];
      }
    });
  }

  return result.named;
}

/**
 * 获取脚本目录路径
 * @param {string} importMetaUrl - import.meta.url
 * @returns {string} - __dirname
 */
export function getScriptDir(importMetaUrl) {
  const __filename = fileURLToPath(importMetaUrl);
  return dirname(__filename);
}

/**
 * 获取项目路径
 * @param {string} scriptDir - __dirname
 * @returns {Object} - { scriptDir, skillRoot, projectRoot, workspace }
 */
export function getProjectPaths(scriptDir) {
  const SKILL_ROOT = resolve(scriptDir, '..');
  const PROJECT_ROOT = resolve(SKILL_ROOT, '..', '..');
  return {
    scriptDir,
    skillRoot: SKILL_ROOT,
    projectRoot: PROJECT_ROOT,
    workspace: join(PROJECT_ROOT, 'workspace'),
  };
}

/**
 * 从 skill 根目录读取 bugfix 配置
 * @param {string} scriptDir - 当前脚本目录
 * @returns {Object} - 配置对象
 */
export function loadBugfixConfig(scriptDir) {
  const { skillRoot } = getProjectPaths(scriptDir);
  const configPath = join(skillRoot, '.bugfix-config.json');
  const exampleConfigPath = join(skillRoot, '.bugfix-config.example.json');

  if (!existsSync(configPath)) {
    throw new Error(`Bugfix config not found: ${configPath}. Create it from ${exampleConfigPath} with your local Redmine credentials.`);
  }

  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse bugfix config: ${configPath} (${error.message})`);
  }

  const redmine = config?.redmine || {};
  if (!redmine.baseUrl || !redmine.username || !redmine.password) {
    throw new Error(`Invalid bugfix config: missing redmine.baseUrl/username/password in ${configPath}. See ${exampleConfigPath} for the required shape.`);
  }

  return config;
}
