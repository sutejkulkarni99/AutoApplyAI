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

  return (
    <div className="min-h-screen bg-[#131314] text-[#e3e3e3] flex items-center justify-center p-4 relative overflow-hidden select-none">
      <div className="w-full max-w-md bg-[#1e1f20] border border-[#282a2c] rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#8ab4f8]/10 text-[#8ab4f8] border border-[#8ab4f8]/20 mb-3.5">
            <FileCode2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[#f2f2f2] tracking-tight">AutoApply Homelab</h1>
          <p className="text-xs text-[#8e918f] mt-1.5 leading-relaxed">
            LaTeX CV & Application Suite
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8e918f] mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#8e918f] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-[#131314] border border-[#282a2c] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8e918f] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8e918f] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#131314] border border-[#282a2c] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#131314] font-semibold py-2.5 px-4 rounded-xl text-xs transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-[#131314]/30 border-t-[#131314] rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Self-Hosted Footer */}
        <div className="mt-7 pt-5 border-t border-[#282a2c] flex items-center justify-between text-[11px] text-[#8e918f]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Self-Hosted & Isolated</span>
          </div>
          <span className="font-mono text-[10px] text-[#5f6368]">v2.4.0</span>
        </div>
      </div>
    </div>
  );
}
