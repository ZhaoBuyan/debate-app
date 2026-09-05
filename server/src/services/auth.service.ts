// server/src/services/auth.service.ts

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.js";
import { User, UserSession } from "../types/index.js";
import { config } from "../utils/config.js";

export class AuthService {
  /**
   * 用户注册
   */
  async register(
    username: string,
    password: string,
  ): Promise<{ user: Omit<User, "password_hash">; token: string }> {
    const name = (username || "").trim();
    if (name.length < 3 || name.length > 20) {
      throw new Error("用户名长度需为 3-20 个字符");
    }
    if (!/^[\u4e00-\u9fa5A-Za-z0-9_]+$/.test(name)) {
      throw new Error("用户名仅支持中文、字母、数字与下划线");
    }
    if (!password || password.length < 6) {
      throw new Error("密码至少需要6个字符");
    }

    const db = await getDb();

    // 检查用户名是否已存在
    const existing = await db.get("SELECT id FROM users WHERE username = ?", [
      name,
    ]);
    if (existing) {
      throw new Error("用户名已存在");
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.run(
      `INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)`,
      [id, name, hashedPassword],
    );

    const user = await db.get(
      `SELECT id, username, role, avatar, points, rank, wins, losses, is_banned FROM users WHERE id = ?`,
      [id],
    );

    const token = jwt.sign({ userId: id }, config.jwtSecret, {
      expiresIn: "7d",
    });

    return { user, token };
  }

  /**
   * 用户登录
   */
  async login(
    username: string,
    password: string,
    ip?: string,
  ): Promise<{ user: Omit<User, "password_hash">; token: string }> {
    const name = (username || "").trim();
    if (!name || !password) {
      throw new Error("用户名和密码不能为空");
    }

    const db = await getDb();

    const user = await db.get(`SELECT * FROM users WHERE username = ?`, [
      name,
    ]);

    if (!user) {
      throw new Error("用户名或密码错误");
    }

    // 检查是否被封禁
    if (user.is_banned) {
      const now = Date.now();
      if (user.banned_until && user.banned_until > now) {
        throw new Error(
          `账号已被封禁，解封时间: ${new Date(user.banned_until).toLocaleString()}`,
        );
      } else if (user.banned_until === null) {
        throw new Error("账号已被永久封禁");
      }
      // 临时封禁已到期：自动解封并继续登录
      await db.run(
        `UPDATE users SET is_banned = 0, banned_reason = NULL, banned_at = NULL, banned_until = NULL
         WHERE id = ?`,
        [user.id],
      );
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new Error("用户名或密码错误");
    }

    // 更新最后登录信息
    await db.run(
      `UPDATE users SET last_login_ip = ?, last_login_at = ? WHERE id = ?`,
      [ip || null, Date.now(), user.id],
    );

    const userData = {
      id: user.id,
      username: user.username,
      role: user.role,
      avatar: user.avatar,
      points: user.points,
      rank: user.rank,
      wins: user.wins,
      losses: user.losses,
      is_banned: user.is_banned,
      banned_reason: user.banned_reason,
      banned_at: user.banned_at,
      banned_until: user.banned_until,
      warning_count: user.warning_count,
      last_login_ip: user.last_login_ip,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    };

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: "7d",
    });

    return { user: userData, token };
  }

  /**
   * 验证 JWT Token
   */
  verifyToken(token: string): UserSession | null {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      return { id: decoded.userId };
    } catch {
      return null;
    }
  }

  /**
   * 根据 ID 获取用户信息（用于中间件）
   */
  async getUserById(id: string): Promise<UserSession | null> {
    const db = await getDb();
    const user = await db.get(
      `SELECT id, username, role, is_banned FROM users WHERE id = ?`,
      [id],
    );
    return user || null;
  }

  /**
   * 获取完整公开资料（/auth/me）
   */
  async getProfile(id: string) {
    const db = await getDb();
    return db.get(
      `SELECT id, username, role, avatar, points, rank, wins, losses,
              warning_count, is_banned, banned_reason, banned_at, banned_until,
              created_at, last_login_at
       FROM users WHERE id = ?`,
      [id],
    );
  }

  /**
   * 修改密码（需验证旧密码）
   */
  async changePassword(id: string, oldPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error("新密码至少需要6个字符");
    }
    if (!oldPassword) {
      throw new Error("请输入当前密码");
    }
    const db = await getDb();
    const user = await db.get<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = ?",
      [id],
    );
    if (!user) throw new Error("用户不存在");
    const ok = await bcrypt.compare(oldPassword, user.password_hash);
    if (!ok) throw new Error("当前密码不正确");
    const hash = await bcrypt.hash(newPassword, 10);
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, id]);
  }

  /**
   * 更新头像（emoji）
   */
  async updateAvatar(id: string, avatar: string) {
    const av = (avatar || "").trim();
    if (!av || av.length > 8) {
      throw new Error("头像不合法（限 1-8 个字符）");
    }
    const db = await getDb();
    await db.run("UPDATE users SET avatar = ? WHERE id = ?", [av, id]);
    return this.getProfile(id);
  }

  /**
   * 我的活动概览（个人资料页数据源）
   */
  async getMyActivities(id: string) {
    const db = await getDb();
    const profile = await this.getProfile(id);
    const joined = await db.all(
      `SELECT d.id, d.title, d.status, d.debate_type, d.category, d.start_time, d.end_time,
              t.side, t.order_index, t.joined_at,
              (SELECT COUNT(*) FROM speeches s WHERE s.debate_id = d.id AND s.user_id = t.user_id) as speech_count
       FROM debaters t
       JOIN debates d ON d.id = t.debate_id
       WHERE t.user_id = ?
       ORDER BY d.created_at DESC LIMIT 30`,
      [id],
    );
    const bestReceived = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) cnt FROM votes_best WHERE target_user_id = ?",
      [id],
    );
    const speechTotal = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) cnt FROM speeches WHERE user_id = ?",
      [id],
    );
    return {
      profile,
      joined,
      bestDebaterVotes: bestReceived?.cnt || 0,
      speechTotal: speechTotal?.cnt || 0,
    };
  }
}

export default new AuthService();
