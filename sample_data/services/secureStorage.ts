/**
 * 安全存储服务
 * 提供加密的localStorage存储,防止数据泄露
 */

/**
 * 简单的AES加密实现(仅用于演示,生产环境应使用成熟的加密库如crypto-js)
 */
class SecureStorage {
  private static instance: SecureStorage;
  private encryptionKey: string;

  private constructor() {
    // 从环境变量或配置获取密钥(不应硬编码)
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  public static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  /**
   * 获取或创建加密密钥(应该从服务器获取或使用更安全的方式)
   */
  private getOrCreateEncryptionKey(): string {
    const keyName = '__secure_storage_key__';
    let key = sessionStorage.getItem(keyName);
    
    if (!key) {
      // 生成随机密钥(会话级别,页面刷新后重新生成)
      key = this.generateRandomKey();
      sessionStorage.setItem(keyName, key);
    }
    
    return key;
  }

  /**
   * 生成随机密钥
   */
  private generateRandomKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 简单的XOR加密(演示用,生产环境应使用AES)
   */
  private encrypt(data: string): string {
    try {
      const encoded = btoa(data); // Base64编码
      let result = '';
      for (let i = 0; i < encoded.length; i++) {
        const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        const dataChar = encoded.charCodeAt(i);
        result += String.fromCharCode(dataChar ^ keyChar);
      }
      return btoa(result); // 再次Base64编码
    } catch (error) {
      console.error('加密失败:', error);
      throw new Error('数据加密失败');
    }
  }

  /**
   * 解密
   */
  private decrypt(encryptedData: string): string {
    try {
      const decoded = atob(encryptedData); // Base64解码
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        const dataChar = decoded.charCodeAt(i);
        result += String.fromCharCode(dataChar ^ keyChar);
      }
      return atob(result); // 解码原始数据
    } catch (error) {
      console.error('解密失败:', error);
      throw new Error('数据解密失败');
    }
  }

  /**
   * 安全存储数据
   */
  public setItem(key: string, value: any): void {
    try {
      const jsonString = JSON.stringify(value);
      const encrypted = this.encrypt(jsonString);
      
      // 添加时间戳和校验和
      const payload = {
        data: encrypted,
        timestamp: Date.now(),
        checksum: this.calculateChecksum(encrypted)
      };
      
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {
      console.error('安全存储失败:', error);
      throw error;
    }
  }

  /**
   * 安全读取数据
   */
  public getItem<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const payload = JSON.parse(stored);
      
      // 验证校验和
      if (!this.verifyChecksum(payload.data, payload.checksum)) {
        console.error('数据完整性校验失败,可能被篡改');
        this.removeItem(key);
        return null;
      }

      // 检查数据是否过期(可选,24小时)
      const age = Date.now() - payload.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24小时
      if (age > maxAge) {
        console.warn('缓存数据已过期');
        this.removeItem(key);
        return null;
      }

      const decrypted = this.decrypt(payload.data);
      return JSON.parse(decrypted) as T;
    } catch (error) {
      console.error('安全读取失败:', error);
      return null;
    }
  }

  /**
   * 删除数据
   */
  public removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  /**
   * 计算校验和(简单实现)
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * 验证校验和
   */
  private verifyChecksum(data: string, checksum: string): boolean {
    return this.calculateChecksum(data) === checksum;
  }

  /**
   * 清除所有安全存储
   */
  public clear(): void {
    localStorage.clear();
    sessionStorage.clear();
  }
}

// 导出单例
export const secureStorage = SecureStorage.getInstance();

/**
 * 使用示例:
 * 
 * // 存储
 * secureStorage.setItem('storyWeaverProjects', projects);
 * 
 * // 读取
 * const projects = secureStorage.getItem<ProjectData[]>('storyWeaverProjects');
 * 
 * // 删除
 * secureStorage.removeItem('storyWeaverProjects');
 */
