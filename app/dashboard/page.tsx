"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { generateStoryReport } from "@/lib/pdf-export";
import ProfileChip from "@/components/ProfileChip";




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
    average_sentence_length: number;
  };
  sentiment?: { section: number | string; score: number }[];
  relationshipGraph?: {
    nodes: { id: string; type: string }[];
    links: { source: string; target: string; type: string }[];
  };
  analysisMode?: "quick" | "deep";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest">("newest");
  const [selectedTheme, setSelectedTheme] = useState<string>("All");
  const [minScore, setMinScore] = useState<number>(0);

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
    setLoading(true);
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch analyses:", error.message);
    } else {
      setAnalyses(data ?? []);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this analysis?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) {
      alert("Failed to delete analysis: " + error.message);
    } else {
      setAnalyses(prev => prev.filter(a => a.id !== id));
    }
    setDeletingId(null);
  };

  const handleDownloadPdf = async (analysis: Analysis) => {
    setExportingId(analysis.id);
    try {
      await generateStoryReport(analysis.story, analysis.result);
    } catch (err) {
      console.error("PDF Export failed:", err);
    } finally {
      setExportingId(null);
    }
  };

  // Computed Values
  const filteredAnalyses = useMemo(() => {
    let result = [...analyses];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.story.toLowerCase().includes(q) || 
        a.result.summary?.toLowerCase().includes(q) ||
        a.result.themes?.some(t => t.toLowerCase().includes(q))
      );
    }

    // Theme Filter
    if (selectedTheme !== "All") {
      result = result.filter(a => a.result.themes?.includes(selectedTheme));
    }

    // Score Filter
    if (minScore > 0) {
      result = result.filter(a => a.result.overallScore >= minScore);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "highest") return b.result.overallScore - a.result.overallScore;
      return 0;
    });

    return result;
  }, [analyses, searchQuery, sortBy, selectedTheme, minScore]);

  const themesList = useMemo(() => {
    const themes = new Set<string>();
    analyses.forEach(a => a.result.themes?.forEach(t => themes.add(t)));
    return ["All", ...Array.from(themes).sort()];
  }, [analyses]);

  const stats = useMemo(() => {
    if (analyses.length === 0) return { total: 0, avg: "--", best: "--", favorite: "--" };
    
    const total = analyses.length;
    const avg = (analyses.reduce((s, a) => s + a.result.overallScore, 0) / total).toFixed(1);
    const best = Math.max(...analyses.map(a => a.result.overallScore));
    
    const themeCounts: Record<string, number> = {};
    analyses.forEach(a => a.result.themes?.forEach(t => themeCounts[t] = (themeCounts[t] || 0) + 1));
    const favorite = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "--";

    return { total, avg, best, favorite };
  }, [analyses]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-200 via-gray-100 to-indigo-100 flex flex-col p-8 md:p-12 animate-pulse">
        <div className="max-w-6xl w-full mx-auto space-y-8">
          <div className="h-40 bg-white/50 rounded-3xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/50 rounded-2xl"></div>)}
          </div>
          <div className="h-96 bg-white/50 rounded-3xl"></div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-200 via-gray-100 to-indigo-100 text-slate-800 flex flex-col p-4 sm:p-8 md:p-12 overflow-x-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      {/* Nav */}
      <nav className="relative z-50 w-full max-w-6xl mx-auto flex justify-between items-center mb-10">
        <button
          onClick={() => router.push("/")}
          className="flex items-center space-x-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          <span>Back to Analyzer</span>
        </button>
        <ProfileChip user={user} onSignOut={handleSignOut} />





      </nav>

      <div className="max-w-6xl w-full mx-auto relative z-10 flex flex-col space-y-8">

        {/* Redesigned Profile Card - Light Subtle Version */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4, transition: { duration: 0.3 } }}
          className="group relative w-full overflow-hidden rounded-[2.5rem] p-[1px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500 hover:shadow-indigo-500/10"
        >
          {/* Subtle Animated Gradient Border */}
          <div className="absolute inset-0 animate-border-spin bg-gradient-to-r from-indigo-200 via-purple-200 to-rose-200 opacity-40 group-hover:opacity-100 transition-opacity duration-700" />
          
          <div className="relative h-full w-full bg-white/40 backdrop-blur-3xl rounded-[2.5rem] p-8 sm:p-12 overflow-hidden">
            {/* Background Decorative Elements - Softer Pastels */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-200/20 rounded-full -mr-40 -mt-40 blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-200/20 rounded-full -ml-40 -mb-40 blur-[80px]" />
            <div className="absolute inset-0 bg-noise opacity-[0.015] pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8 sm:gap-12">
              {/* Avatar Section */}
              <div className="relative group/avatar">
                <div className="absolute -inset-2 bg-gradient-to-tr from-indigo-100 via-purple-100 to-rose-100 rounded-full blur-md opacity-50 group-hover/avatar:opacity-100 transition duration-700" />
                <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full p-1.5 bg-white overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                  {user.user_metadata?.avatar_url ? (
                    <img 
                      src={user.user_metadata.avatar_url} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover transition-transform duration-1000 group-hover/avatar:scale-105" 
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-indigo-400 font-bold text-4xl font-playfair">
                      {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                </div>
                {/* Subtle Inner Glow Ring */}
                <div className="absolute inset-0 rounded-full border border-white/60 scale-100 pointer-events-none" />
              </div>

              {/* Info Section */}
              <div className="flex-1 text-center sm:text-left space-y-4">
                <div className="space-y-1.5">
                  <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 font-playfair tracking-tight leading-tight">
                    {user.user_metadata?.full_name || "Writer"}
                  </h1>
                  
                  {/* Writer Badge - Softer Style */}
                  <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/60 border border-indigo-100/50 text-indigo-500 text-[10px] font-bold uppercase tracking-[0.2em] shadow-sm">
                    <svg className="w-3 h-3 mr-2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Literary Member
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-center sm:justify-start text-slate-500 font-medium group/email cursor-default">
                    <div className="p-1.5 rounded-lg bg-white/50 border border-slate-100 mr-3 shadow-sm group-hover/email:bg-white group-hover/email:border-indigo-100 transition-all">
                      <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm tracking-wide">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start text-slate-400 font-medium group/date cursor-default">
                    <div className="p-1.5 rounded-lg bg-white/50 border border-slate-100 mr-3 shadow-sm group-hover/date:bg-white group-hover/date:border-indigo-100 transition-all">
                      <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-bold">
                      Joined {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>



        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[
            { 
              label: "Total Analyses", 
              val: stats.total, 
              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>,
              color: "text-indigo-600", 
              bg: "from-indigo-50/50 to-white",
              border: "border-indigo-100"
            },
            { 
              label: "Average Score", 
              val: stats.avg, 
              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>,
              color: "text-purple-600", 
              bg: "from-purple-50/50 to-white",
              border: "border-purple-100"
            },
            { 
              label: "Best Score", 
              val: stats.best, 
              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z"></path></svg>,
              color: "text-emerald-600", 
              bg: "from-emerald-50/50 to-white",
              border: "border-emerald-100"
            },
            { 
              label: "Favorite Theme", 
              val: stats.favorite, 
              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>,
              color: "text-amber-600", 
              bg: "from-amber-50/50 to-white",
              border: "border-amber-100"
            },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
              className={`relative overflow-hidden bg-gradient-to-br ${s.bg} backdrop-blur-md p-6 rounded-3xl border ${s.border} shadow-lg group transition-all`}
            >
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/40 rounded-full blur-2xl group-hover:bg-white/60 transition-colors"></div>
              <div className={`mb-3 p-2 rounded-xl bg-white w-fit shadow-sm ${s.color}`}>
                {s.icon}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 font-inter">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color} truncate relative z-10 font-space-grotesk`}>{s.val}</p>
            </motion.div>
          ))}
        </div>

        {/* History Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-white/80 backdrop-blur-md border border-white/50 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <h2 className="text-xl font-bold text-slate-800 flex items-center font-inter">
              <svg className="w-6 h-6 mr-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Analysis History
            </h2>


            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search stories..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              
              <select 
                value={selectedTheme} 
                onChange={e => setSelectedTheme(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none"
              >
                {themesList.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="highest">Highest Score</option>
              </select>
            </div>
          </div>

          {filteredAnalyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-slate-50 p-6 rounded-full mb-4">
                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-700">No results found.</h3>
              <p className="text-slate-400 text-sm max-w-xs mt-1">Try adjusting your search or filters, or analyze a new story.</p>
              {analyses.length === 0 && (
                <button onClick={() => router.push("/")} className="mt-6 bg-indigo-600 text-white font-bold py-2.5 px-8 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">Start First Analysis</button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAnalyses.map((a, i) => {
                const title = a.story.split(" ").slice(0, 5).join(" ") + "...";
                const date = new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const isExpanded = expandedId === a.id;
                
                return (
                  <motion.div 
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="group border border-slate-100 bg-white/50 rounded-2xl p-5 hover:border-indigo-200 hover:bg-white transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm font-space-grotesk ${
                          a.result.overallScore >= 8 ? "bg-emerald-100 text-emerald-600"
                          : a.result.overallScore >= 5 ? "bg-amber-100 text-amber-600"
                          : "bg-rose-100 text-rose-600"
                        }`}>
                          {a.result.overallScore}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 line-clamp-1">{title}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{date}</p>
                            {a.result.analysisMode && (
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                                a.result.analysisMode === "quick" ? "bg-amber-50 text-amber-500 border border-amber-100" : "bg-indigo-50 text-indigo-500 border border-indigo-100"
                              }`}>
                                {a.result.analysisMode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDownloadPdf(a)} 
                          disabled={exportingId === a.id}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          {exportingId === a.id ? (
                            <svg className="w-4 h-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                          )}
                        </button>
                        <button 
                          onClick={() => handleDelete(a.id)} 
                          disabled={deletingId === a.id}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {a.result.themes?.slice(0, 3).map(t => (
                        <span key={t} className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{t}</span>
                      ))}
                    </div>

                    <button 
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      className="w-full py-2 bg-slate-50 hover:bg-indigo-50 text-[10px] font-black text-slate-500 hover:text-indigo-600 rounded-xl transition-colors uppercase tracking-widest"
                    >
                      {isExpanded ? "Close Details" : "View Full Details"}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-4 pt-4 border-t border-slate-100 space-y-4"
                        >
                          <p className="text-xs text-slate-600 italic leading-relaxed">"{a.result.summary}"</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { l: "Grammar", v: a.result.grammar },
                              { l: "Plot", v: a.result.plot },
                              { l: "Flow", v: a.result.pacing },
                            ].map(x => (
                              <div key={x.l} className="bg-slate-50 rounded-xl p-2 text-center">
                                <p className="text-[8px] font-bold text-slate-400 uppercase font-inter">{x.l}</p>
                                <p className="text-sm font-bold text-slate-700 font-space-grotesk">{x.v}</p>
                              </div>
                            ))}
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
