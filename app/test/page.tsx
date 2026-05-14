"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestPage() {
  const [connStatus, setConnStatus] = useState("Testing Supabase connection...");
  const [insertStatus, setInsertStatus] = useState("Testing table insert...");
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    async function runTests() {
      // Test 1: Auth session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setConnStatus("❌ Connection failed: " + sessionError.message);
      } else {
        setConnStatus("✅ Supabase connected successfully.");
      }

      const session = sessionData?.session;
      if (session?.user) {
        setUser(session.user.id);

        // Test 2: Insert into analyses table
        const { error: insertError } = await supabase
          .from("analyses")
          .insert({
            user_id: session.user.id,
            story: "Test story from /test page.",
            result: { test: true, overallScore: 7 },
          });

        if (insertError) {
          setInsertStatus("❌ Insert failed: " + insertError.message + " | Code: " + insertError.code);
          console.error("Insert error full:", insertError);
        } else {
          setInsertStatus("✅ Insert successful! Row saved to analyses table.");
        }
      } else {
        setInsertStatus("⚠️ Not logged in — skipping insert test.");
      }
    }

    runTests();
  }, []);

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-200 via-gray-100 to-indigo-100 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-lg bg-white/80 backdrop-blur-md border border-white/50 p-10 rounded-3xl shadow-2xl flex flex-col items-center text-center gap-6">
        <div className="mb-2 bg-indigo-100 p-4 rounded-2xl shadow-sm">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
          Backend Diagnostics
        </h1>

        {user && (
          <p className="text-xs text-slate-400 font-mono bg-slate-100 px-3 py-1 rounded-full">
            User ID: {user}
          </p>
        )}

        <StatusCard label="Connection" message={connStatus} />
        <StatusCard label="Table Insert" message={insertStatus} />
      </div>
    </main>
  );
}

function StatusCard({ label, message }: { label: string; message: string }) {
  const isSuccess = message.startsWith("✅");
  const isError = message.startsWith("❌");
  const isWarn = message.startsWith("⚠️");
  const isPending = !isSuccess && !isError && !isWarn;

  return (
    <div className={`w-full text-left px-5 py-4 rounded-xl border shadow-sm transition-colors duration-500 ${
      isSuccess ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : isError ? "bg-rose-50 text-rose-700 border-rose-200"
      : isWarn ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse"
    }`}>
      <p className="text-xs font-bold uppercase tracking-widest mb-1 opacity-60">{label}</p>
      <p className={`text-sm font-medium ${isPending ? "animate-pulse" : ""}`}>{message}</p>
    </div>
  );
}
