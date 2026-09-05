import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { errMsg } from "../api";

const FEATURES = [
  { icon: "🎙️", title: "结构化辩论", desc: "正反双方 · 轮次计时 · 全程留档" },
  { icon: "📡", title: "实时交锋", desc: "支持率、投票、情绪与聊天实时同步" },
  { icon: "🤖", title: "AI 复盘", desc: "论点提炼 · 辩论树 · 赛后报告" },
  { icon: "🧊", title: "理性社区", desc: "冷静期 · 举报 · 敏感词全链路治理" },
];

function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) return setError("请输入用户名");
    if (!password) return setError("请输入密码");
    // 注册模式才校验长度/强度；登录交给后端校验（兼容任意历史用户名）
    if (mode === "register") {
      if (username.trim().length < 3) return setError("用户名至少 3 个字符");
      if (password.length < 6) return setError("密码至少 6 个字符");
      if (password !== password2) return setError("两次输入的密码不一致");
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password);
      }
      navigate("/debates");
    } catch (err) {
      setError(errMsg(err, mode === "login" ? "登录失败" : "注册失败"));
    }
    setLoading(false);
  };

  const inputCls =
    "w-full p-3 bg-gray-800/80 rounded-xl border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 focus:bg-gray-800 transition";

  return (
    <div className="min-h-screen app-bg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid md:grid-cols-[1.15fr_1fr] rounded-3xl overflow-hidden border border-gray-700/80 bg-gray-900/60 backdrop-blur shadow-2xl shadow-black/40">
        {/* 左：品牌区（桌面） */}
        <div className="hidden md:flex flex-col justify-between p-10 lg:p-12 bg-gradient-to-br from-gray-900 via-gray-900 to-orange-950/40 border-r border-gray-800">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <span className="text-4xl" aria-hidden>🗣️</span>
              <h1 className="text-3xl font-bold">
                <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                  辩论平台
                </span>
              </h1>
            </div>
            <p className="text-gray-400 leading-relaxed text-[15px]">
              让每一种立场都被认真听完，
              <br />
              让思想在秩序中交锋、在交锋中沉淀。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-10">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white/[0.03] border border-white/10 px-4 py-3.5 hover:border-orange-400/40 hover:bg-white/[0.05] transition"
              >
                <div className="text-xl mb-1.5" aria-hidden>{f.icon}</div>
                <div className="text-sm font-medium text-gray-200">{f.title}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{f.desc}</div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-gray-600 mt-8 leading-relaxed">
            全栈 TypeScript · React + Node + Socket.IO
            <br />
            KN-01 知识沉淀 · KN-03 相关推荐 · AI 标注合规
          </div>
        </div>

        {/* 右：表单区 */}
        <div className="p-8 sm:p-10">
          {/* 移动端标题 */}
          <div className="md:hidden text-center mb-6">
            <div className="text-5xl mb-2" aria-hidden>🗣️</div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              辩论平台
            </h1>
          </div>

          <h2 className="text-xl font-bold text-gray-100 mb-1">
            {mode === "login" ? "欢迎回来 👋" : "创建你的账号"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {mode === "login"
              ? "登录后参与或围观一场有规则的辩论"
              : "注册即加入社区公约，理性发言"}
          </p>

          <div
            className="grid grid-cols-2 gap-1 bg-gray-800/70 rounded-xl p-1 mb-6"
            role="tablist"
          >
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`py-2.5 rounded-lg text-sm font-medium transition ${
                  mode === m
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {m === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="username" className="block text-sm text-gray-400 mb-1.5">
                用户名
              </label>
              <input
                id="username"
                type="text"
                placeholder={mode === "register" ? "至少 3 个字符" : "请输入用户名"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputCls}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-gray-400 mb-1.5">
                密码
              </label>
              <input
                id="password"
                type="password"
                placeholder={mode === "register" ? "至少 6 个字符" : "请输入密码"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </div>
            {mode === "register" && (
              <div>
                <label htmlFor="password2" className="block text-sm text-gray-400 mb-1.5">
                  确认密码
                </label>
                <input
                  id="password2"
                  type="password"
                  placeholder="再次输入密码"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}
            {error && (
              <div className="text-red-300 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-xl py-2.5 px-3">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 rounded-xl font-bold text-white shadow-lg shadow-orange-500/25 transition active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "请稍候..." : mode === "login" ? "登 录" : "注 册"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-800 text-xs text-gray-500 space-y-1.5">
            <div className="font-medium text-gray-400">演示账号（密码均为 123456）</div>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-lg bg-gray-800/80 border border-gray-700">
                👑 admin <span className="text-gray-600">· 管理员</span>
              </span>
              <span className="px-2 py-1 rounded-lg bg-gray-800/80 border border-gray-700">
                😊 testuser <span className="text-gray-600">· 辩手</span>
              </span>
              <span className="px-2 py-1 rounded-lg bg-gray-800/80 border border-gray-700">
                🧑‍🤝‍🧑 张三 / 李四 / 王五 <span className="text-gray-600">· 种子用户</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
