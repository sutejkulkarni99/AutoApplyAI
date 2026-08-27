import React, { useState } from "react";
import { Lock, User, FileCode2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { User as UserType } from "../types";

interface LoginPageProps {
  onLoginSuccess: (user: UserType, token: string) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("autoapply_token", data.token);
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || "Unable to log in. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemoAdmin = () => {
    setUsername("admin");
    setPassword("adminpassword123");
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#fafafa] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Soft Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#6366f1]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#6366f1] text-white shadow-md shadow-[#6366f1]/20 mb-3.5">
            <FileCode2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#fafafa] tracking-tight">AutoApply Homelab</h1>
          <p className="text-xs text-[#a1a1aa] mt-1.5 leading-relaxed">
            LaTeX CV & Cover Letter Application Suite
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-950/30 border border-red-800/50 rounded-xl flex items-start gap-2.5 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or your username"
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-[#6366f1] hover:bg-[#818cf8] text-white font-medium py-2.5 px-4 rounded-xl text-xs transition-all duration-150 flex items-center justify-center gap-2 shadow-md shadow-[#6366f1]/20 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Self-Hosted / Homelab Notice */}
        <div className="mt-7 pt-6 border-t border-[#27272a] text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-[#a1a1aa] mb-2">
            <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
            <span>Self-Hosted & Isolated Homelab</span>
          </div>
          <p className="text-[11px] text-[#71717a] mb-2">
            Initial superadmin default credentials:
          </p>
          <button
            type="button"
            onClick={handleFillDemoAdmin}
            className="text-[11px] font-mono text-[#818cf8] hover:text-[#a5b4fc] bg-[#09090b] px-3 py-1 rounded-lg border border-[#27272a] transition-colors cursor-pointer"
          >
            admin / adminpassword123 (Click to fill)
          </button>
          <p className="text-[10px] text-[#71717a] mt-4 font-mono">
            Crafted by <span className="text-[#a1a1aa]">Sutej Kulkarni</span>
          </p>
        </div>
      </div>
    </div>
  );
}
