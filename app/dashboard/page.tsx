"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type CharacterEntry = {
  name: string;
  mentions: number;
  role: string;
};

type AnalysisResult = {
  overallScore: number;
  grammar: number;
  plot: number;
  characters: number;
  pacing: number;
  originality: number;
  emotionalImpact: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  summary?: string;
  themes?: string[];
  characterList?: CharacterEntry[];
  timeline?: string[];
  readability?: {
    flesch_reading_ease: number;
    grade_level: number;
    word_count: number;
    sentence_count: number;
  };
  sentiment?: { section: number | string; score: number }[];
  relationshipGraph?: {
    nodes: { id: string; type: string }[];
    links: { source: string; target: string; type: string }[];
  };
};

type Analysis = {
  id: string;
  story: string;
  result: AnalysisResult;
  created_at: string;
};

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push("/");
        return;
      }
      setUser(session.user);
      fetchAnalyses(session.user.id);
    }).catch(() => {
      router.push("/");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push("/");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const fetchAnalyses = async (userId: string) => {
    console.log("Fetching analyses for user:", userId);
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch analyses:", error.message, error);
    } else {
      console.log(`Fetched ${data?.length ?? 0} analyses.`);
      setAnalyses(data ?? []);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Computed stats
  const totalAnalyses = analyses.length;
  const avgScore = totalAnalyses > 0
    ? (analyses.reduce((sum, a) => sum + (a.result?.overallScore ?? 0), 0) / totalAnalyses).toFixed(1)
    : "--";
  const bestScore = totalAnalyses > 0
    ? Math.max(...analyses.map(a => a.result?.overallScore ?? 0))
    : "--";

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-200 via-gray-100 to-indigo-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-12 h-12 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-slate-500 font-semibold">Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const stats = [
    { title: "Total Analyses", value: String(totalAnalyses), icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", color: "text-indigo-500", bg: "bg-indigo-50" },
    { title: "Average Score", value: String(avgScore), icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "text-purple-500", bg: "bg-purple-50" },
    { title: "Best Score", value: String(bestScore), icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z", color: "text-amber-500", bg: "bg-amber-50" },
  ];

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-200 via-gray-100 to-indigo-100 text-slate-800 flex flex-col p-4 sm:p-8 md:p-12 overflow-x-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      {/* Nav */}
      <nav className="relative z-50 w-full max-w-6xl mx-auto flex justify-between items-center mb-12">
        <button
          onClick={() => router.push("/")}
          className="flex items-center space-x-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          <span>Back to Analyzer</span>
        </button>
        <div className="flex items-center space-x-4 bg-white/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/50 shadow-sm">
          <button
            onClick={handleSignOut}
            className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div className="max-w-6xl w-full mx-auto relative z-10 flex flex-col space-y-10">

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full bg-white/80 backdrop-blur-md border border-white/50 p-8 sm:p-10 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center sm:space-x-8 text-center sm:text-left"
        >
          <div className="flex-shrink-0 mb-6 sm:mb-0">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile Avatar"
                className="w-28 h-28 rounded-full border-4 border-white shadow-lg object-cover"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-4xl border-4 border-white shadow-lg">
                {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "?").toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              {user.user_metadata?.full_name || "Author"}
            </h1>
            <p className="text-lg font-medium text-slate-500">{user.email}</p>
            <p className="text-sm text-slate-400">Member since {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * (i + 1) }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white/80 backdrop-blur-md border border-white/50 p-6 rounded-3xl shadow-lg hover:shadow-xl transition-shadow flex items-center space-x-6"
            >
              <div className={`${stat.bg} p-4 rounded-2xl ${stat.color}`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon}></path>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.title}</span>
                <span className="text-3xl font-black text-slate-800 mt-1">{stat.value}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Analysis History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="w-full bg-white/80 backdrop-blur-md border border-white/50 p-8 sm:p-10 rounded-3xl shadow-xl"
        >
          <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center">
            <svg className="w-6 h-6 mr-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Analysis History
            {totalAnalyses > 0 && (
              <span className="ml-3 text-sm font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">{totalAnalyses} total</span>
            )}
          </h2>

          {analyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-2">No analyses yet.</h3>
              <p className="text-slate-500 max-w-sm">Head back to the analyzer to run your first story analysis.</p>
              <button
                onClick={() => router.push("/")}
                className="mt-6 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm"
              >
                Analyze a Story
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {analyses.map((analysis, i) => {
                const isExpanded = expandedId === analysis.id;
                const r = analysis.result;
                const date = new Date(analysis.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                });
                const preview = analysis.story.slice(0, 120) + (analysis.story.length > 120 ? "..." : "");

                return (
                  <motion.div
                    key={analysis.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border border-slate-100 rounded-2xl bg-white/70 shadow-sm overflow-hidden"
                  >
                    {/* Row header */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : analysis.id)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/80 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Score badge */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${
                          r.overallScore >= 8 ? "bg-emerald-100 text-emerald-600"
                          : r.overallScore >= 5 ? "bg-amber-100 text-amber-600"
                          : "bg-rose-100 text-rose-600"
                        }`}>
                          {r.overallScore}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">{preview}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{date}</p>
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-slate-400 flex-shrink-0 ml-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-6">
                            {/* Sub-scores */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[
                                { label: "Grammar", score: r.grammar, color: "text-indigo-600", bg: "bg-indigo-50" },
                                { label: "Plot", score: r.plot, color: "text-purple-600", bg: "bg-purple-50" },
                                { label: "Characters", score: r.characters, color: "text-pink-600", bg: "bg-pink-50" },
                                { label: "Pacing", score: r.pacing, color: "text-amber-600", bg: "bg-amber-50" },
                                { label: "Originality", score: r.originality, color: "text-emerald-600", bg: "bg-emerald-50" },
                                { label: "Emotion", score: r.emotionalImpact, color: "text-rose-600", bg: "bg-rose-50" },
                              ].map((item) => (
                                <div key={item.label} className={`${item.bg} rounded-xl p-3 flex flex-col items-center`}>
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{item.label}</span>
                                  <span className={`text-2xl font-black ${item.color}`}>{item.score}</span>
                                </div>
                              ))}
                            </div>

                            {/* Strengths / Weaknesses / Suggestions */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {[
                                { title: "Strengths", items: r.strengths, color: "text-emerald-600", dot: "text-emerald-400" },
                                { title: "Improvement", items: r.weaknesses, color: "text-rose-600", dot: "text-rose-400" },
                                { title: "Suggestions", items: r.suggestions, color: "text-indigo-600", dot: "text-indigo-400" },
                              ].map((section) => (
                                <div key={section.title}>
                                  <h4 className={`text-sm font-black uppercase tracking-wider mb-2 ${section.color}`}>{section.title}</h4>
                                  <ul className="space-y-1">
                                    {section.items.map((item, idx) => (
                                      <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                                        <span className={`${section.dot} mt-0.5 text-base leading-none`}>•</span>
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>

                            {/* Summary */}
                            {r.summary && (
                              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                                <h4 className="text-xs font-black uppercase tracking-wider mb-2 text-slate-500">Summary</h4>
                                <p className="text-xs text-slate-600 italic leading-relaxed">"{r.summary}"</p>
                              </div>
                            )}

                            {/* Readability & Themes Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {r.readability && (
                                <div className="bg-teal-50/50 rounded-2xl p-4 border border-teal-100">
                                  <h4 className="text-xs font-black uppercase tracking-wider mb-2 text-teal-600">Readability</h4>
                                  <div className="flex justify-between text-[10px] font-bold text-teal-700">
                                    <span>Ease: {r.readability.flesch_reading_ease}</span>
                                    <span>Grade: {r.readability.grade_level}</span>
                                    <span>Words: {r.readability.word_count}</span>
                                  </div>
                                </div>
                              )}
                              {r.themes && r.themes.length > 0 && (
                                <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100">
                                  <h4 className="text-xs font-black uppercase tracking-wider mb-2 text-purple-600">Themes</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {r.themes.slice(0, 3).map((t, idx) => (
                                      <span key={idx} className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{t}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

      </div>
    </main>
  );
}
