"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { generateComparisonReport } from "@/lib/pdf-export";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useEffect } from "react";
import ProfileChip from "@/components/ProfileChip";



type CharacterEntry = { name: string; mentions: number; role: string; };
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
  readability?: {
    flesch_reading_ease: number;
    grade_level: number;
    word_count: number;
    sentence_count: number;
    average_sentence_length: number;
  };
  sentiment?: { section: number | string; score: number }[];
  analysisMode?: "quick" | "deep";
};

export default function ComparePage() {
  const [storyA, setStoryA] = useState("");
  const [storyB, setStoryB] = useState("");
  const [resultA, setResultA] = useState<AnalysisResult | null>(null);
  const [resultB, setResultB] = useState<AnalysisResult | null>(null);
  const [compSummary, setCompSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };




  const handleAnalyze = async () => {
    if (!storyA || !storyB) {
      alert("Please provide both stories for comparison.");
      return;
    }
    setLoading(true);
    try {
      // Analyze Story A
      const resA = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: storyA }),
      });
      const dataA = await resA.json();
      
      // Analyze Story B
      const resB = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: storyB }),
      });
      const dataB = await resB.json();

      setResultA(dataA);
      setResultB(dataB);

      // Get Comparison Summary
      const resComp = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisA: dataA, analysisB: dataB }),
      });
      const dataComp = await resComp.json();
      setCompSummary(dataComp.summary);

    } catch (err) {
      console.error("Comparison failed:", err);
      alert("Failed to complete comparison.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!resultA || !resultB) return;
    setIsExporting(true);
    await generateComparisonReport(storyA, resultA, storyB, resultB, compSummary);
    setIsExporting(false);
  };

  const MetricRow = ({ label, valA, valB, higherIsBetter = true }: { label: string, valA: any, valB: any, higherIsBetter?: boolean }) => {
    const isABetter = higherIsBetter ? valA > valB : valA < valB;
    const isBBetter = higherIsBetter ? valB > valA : valB < valA;
    return (
      <div className="flex flex-col space-y-2 py-4 border-b border-slate-100 last:border-0 font-inter">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{label}</span>
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 rounded-2xl text-center font-bold text-lg font-space-grotesk ${isABetter ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500'}`}>
            {valA}
          </div>
          <div className={`p-4 rounded-2xl text-center font-bold text-lg font-space-grotesk ${isBBetter ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500'}`}>
            {valB}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-indigo-50 p-4 sm:p-8 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Nav */}
        <nav className="flex justify-between items-center mb-10">
          <button onClick={() => router.push("/")} className="text-indigo-600 font-bold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-slate-800 font-playfair hidden sm:block">Story Comparison</h1>
          <div className="flex-1 sm:flex-none flex justify-end">
            {user && <ProfileChip user={user} onSignOut={handleSignOut} />}
          </div>



        </nav>

        {!resultA ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-sm font-black text-indigo-600 uppercase tracking-widest px-2">Story A (Original)</label>
              <textarea 
                value={storyA} 
                onChange={(e) => setStoryA(e.target.value)}
                placeholder="Paste the first version of your story here..."
                className="w-full h-80 bg-white border border-slate-200 rounded-3xl p-6 shadow-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all resize-none font-merriweather leading-relaxed"
              />
            </div>
            <div className="space-y-4">
              <label className="text-sm font-bold text-purple-600 uppercase tracking-widest px-2 font-inter">Story B (New Version)</label>
              <textarea 
                value={storyB} 
                onChange={(e) => setStoryB(e.target.value)}
                placeholder="Paste the improved version here..."
                className="w-full h-80 bg-white border border-slate-200 rounded-3xl p-6 shadow-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 outline-none transition-all resize-none font-merriweather leading-relaxed"
              />
            </div>
            <div className="md:col-span-2 flex justify-center mt-4">
              <button 
                onClick={handleAnalyze} 
                disabled={loading}
                className="bg-indigo-600 text-white font-black py-4 px-12 rounded-2xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                {loading ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                )}
                {loading ? "Analyzing Both..." : "Start Comparison"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in duration-700">
            
            {/* Comparison Summary Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-600 rounded-3xl p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <h2 className="text-2xl font-black mb-6 flex items-center gap-3 relative z-10">
                <div className="bg-white/20 p-2 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                Which Story Performs Better?
              </h2>
              <div className="prose prose-invert max-w-none relative z-10">
                <p className="text-indigo-50 font-medium leading-relaxed whitespace-pre-wrap">{compSummary}</p>
              </div>
              <div className="mt-8 flex justify-end relative z-10">
                <button onClick={handleDownloadPdf} disabled={isExporting} className="bg-white text-indigo-600 font-bold px-6 py-2 rounded-xl hover:bg-indigo-50 transition-colors flex items-center gap-2">
                  {isExporting ? "Generating..." : "Download Comparison Report"}
                </button>
              </div>
            </motion.div>

            {/* Side-by-Side Comparison Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* Core Metrics */}
              <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 border border-white/50 shadow-xl">
                <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-widest">Core Metrics</h3>
                <MetricRow label="Overall Score" valA={resultA!.overallScore} valB={resultB!.overallScore} />
                <MetricRow label="Grammar" valA={resultA!.grammar} valB={resultB!.grammar} />
                <MetricRow label="Plot" valA={resultA!.plot} valB={resultB!.plot} />
                <MetricRow label="Characters" valA={resultA!.characters} valB={resultB!.characters} />
                <MetricRow label="Pacing" valA={resultA!.pacing} valB={resultB!.pacing} />
                <MetricRow label="Emotional Impact" valA={resultA!.emotionalImpact} valB={resultB!.emotionalImpact} />
              </div>

              {/* Readability Comparison */}
              <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 border border-white/50 shadow-xl">
                <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-widest">Readability</h3>
                <MetricRow label="Flesch Reading Ease" valA={resultA!.readability?.flesch_reading_ease} valB={resultB!.readability?.flesch_reading_ease} />
                <MetricRow label="Grade Level" valA={resultA!.readability?.grade_level} valB={resultB!.readability?.grade_level} higherIsBetter={false} />
                <MetricRow label="Word Count" valA={resultA!.readability?.word_count} valB={resultB!.readability?.word_count} />
                <MetricRow label="Average Sentence Length" valA={resultA!.readability?.average_sentence_length} valB={resultB!.readability?.average_sentence_length} higherIsBetter={false} />
              </div>

              {/* Sentiment Charts */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-lg">
                  <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4">Sentiment Flow A</h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={resultA!.sentiment}>
                        <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={false} />
                        <YAxis domain={[-1, 1]} hide />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-lg">
                  <h4 className="text-xs font-black text-purple-500 uppercase tracking-widest mb-4">Sentiment Flow B</h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={resultB!.sentiment}>
                        <Line type="monotone" dataKey="score" stroke="#a855f7" strokeWidth={3} dot={false} />
                        <YAxis domain={[-1, 1]} hide />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-center">
              <button onClick={() => setResultA(null)} className="text-slate-400 font-bold hover:text-indigo-600 transition-colors uppercase tracking-widest text-xs underline decoration-2 underline-offset-8">Analyze Different Versions</button>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
